import { useState, useRef, useEffect } from "react";
import { Input, Button, message, Spin } from "antd";
import fetchEventStream, { RetriableError, FatalError } from "./api/sse.ts";
import { EventStreamContentType } from "@microsoft/fetch-event-source";
import { Marked } from "marked";
import { mangle } from "marked-mangle";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import config from "../public/config.ts";

const { TextArea } = Input;
const ctrl = new AbortController();
const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs m-2 border-1 w-[50vw] rounded-lg language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);
marked.setOptions({
  gfm: true
})
marked.use(mangle());

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [historyChatList, setHistoryChatList] = useState<
    Array<{ msg: string; me: boolean }>
  >([]);
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (!contentRef.current) return;
    contentRef.current.scrollTo({
      top: contentRef.current.scrollHeight,
      behavior: "smooth",
    })
  };

  useEffect(() => {
    scrollToBottom();
  }, [historyChatList]);

  const chatHandlerV3 = () => {
    if (query.trim() === "") {
      messageApi.error("请输入问题!");
      return;
    }
    setQuery("");
    setLoading(true);
    setHistoryChatList((prev) => [...prev, { msg: query, me: true }]);
    let index = historyChatList.length + 1;
    let buffer = "";
    fetchEventStream({
      url: config.url.v3,
      signal: ctrl.signal,
      body: JSON.stringify({
        query,
      }),
      onmessage(ev) {
        if (ev.event === "message") {
          try {
            const decodedData = ev.data
              .replace(/\\n/g, "\n")
              .replace(/\\:/g, ":")
              .replace(/&nbsp;/g, " ");
            buffer += decodedData;
            setHistoryChatList((prev) => {
              const newList = [...prev];
              newList[index] = {
                msg: marked.parse(buffer).toString(),
                me: false,
              };
              return newList;
            });
          } catch (error) {
            console.error("onmessage -> ", error);
            throw new FatalError();
          }
        }
        if (ev.event === "end") {
          console.log("end", buffer);
          setLoading(false);
          scrollToBottom();
        }
      },
      async onopen(response) {
        if (
          response.ok &&
          response.headers.get("content-type") === EventStreamContentType
        ) {
          console.log("open", response);
          return; // 一切正常
        } else if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          console.log("open", response);
          // 客户端错误通常是不可重试的：
          throw new FatalError();
        } else {
          console.log("open", response);
          throw new RetriableError();
        }
      },
      onclose() {
        console.log("close");
      },
      onerror(err) {
        setQuery("");
        setLoading(false);
        if (err instanceof FatalError) {
          console.log("FatalError", err);
          messageApi.error("请求失败，请稍后重试");
          throw err;
        }
        console.log("RetriableError", err);
      },
    });
  };

  return (
    <>
      {contextHolder}
      <div
        ref={contentRef}
        className="h-[70vh] m-2 p-5 border-1 rounded-lg border-slate-400 overflow-auto"
      >
        {historyChatList.map((item, index) => {
          return (
            <div key={index} className="flex flex-col">
              {item.me ? (
                <div className="flex justify-end items-center w-full mb-4">
                  <div className="bg-slate-400 rounded-lg p-2">{item.msg}</div>
                </div>
              ) : (
                <div className="bg-slate-300 rounded-lg p-4 mb-4">
                  <div dangerouslySetInnerHTML={{ __html: item.msg }}></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <hr className="text-slate-400" />
      <div className="p-5 h-[20vh]">
        <Spin spinning={loading}>
          <TextArea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={4}
            placeholder="input your question here..."
            size="small"
          />
        </Spin>
        <div className="mt-2 flex justify-center items-center">
          <Button
            loading={loading}
            className="w-[40%]"
            onClick={chatHandlerV3}
            color="primary"
            variant="solid"
          >
            Send
          </Button>
          <Button
            disabled={!loading}
            className="w-[40%] ml-2"
            onClick={() => {
              ctrl.abort();
              setLoading(false);
              messageApi.info("对话终止");
            }}
            color="danger"
            variant="solid"
          >
            Stop
          </Button>
        </div>
      </div>
    </>
  );
}

export default App;
