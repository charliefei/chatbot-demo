import { useState, useRef, useEffect } from "react";
import { Input, Button, message, Spin } from "antd";
import fetchEventStream, { RetriableError, FatalError } from "./api/sse.ts";
import { EventStreamContentType } from "@microsoft/fetch-event-source";
import { Marked } from "marked";
import { mangle } from "marked-mangle";
import markedKatex from "marked-katex-extension";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import config from "../public/config.ts";

const { TextArea } = Input;
const ctrl = new AbortController();
const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs m-2 border-1 w-[50vw] font-(family-name:--font-roboto) rounded-lg language-",
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
marked.use(markedKatex({
  throwOnError: false
}));

type ChatMsg = { 
  content: string;
  role: 'user' | 'assistant' | 'system';
  me: boolean;
}

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [historyChatList, setHistoryChatList] = useState<
    Array<ChatMsg>
  >(localStorage.getItem("historyChatList") ? JSON.parse(localStorage.getItem("historyChatList") || "[]") : []);
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (!contentRef.current) return;
    contentRef.current.scrollTo({
      top: contentRef.current.scrollHeight,
      behavior: "smooth",
    })
  };

  const clearHistoryChat = () => {
    setHistoryChatList([]);
    localStorage.removeItem("historyChatList");
    messageApi.info("清空上下文成功");
  };

  useEffect(() => {
    scrollToBottom();
    if (!loading) {
      localStorage.setItem('historyChatList', JSON.stringify(historyChatList))
    }
  }, [historyChatList, loading]);

  const chatHandlerV3 = () => {
    if (query.trim() === "") {
      messageApi.error("请输入问题!");
      return;
    }
    setQuery("");
    setLoading(true);
    setHistoryChatList((prev) => [...prev, { content: query, me: true, role: 'user' }]);
    let index = historyChatList.length + 1;
    let buffer = "";
    fetchEventStream({
      url: config.url.v4,
      signal: ctrl.signal,
      body: JSON.stringify({
        query,
        history: JSON.stringify(historyChatList),
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
                content: buffer,
                me: false,
                role: 'assistant'
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
      <main className="w-screen h-screen overflow-hidden">
        <div
          ref={contentRef}
          className="h-[78%] w-full p-5 border-slate-400 overflow-auto"
        >
          {historyChatList.map((item, index) => {
            return (
              <div key={index} className="flex flex-col">
                {item.me ? (
                  <div className="flex justify-end items-center w-full mb-4">
                    <div className="border-1 rounded-lg p-2">{item.content}</div>
                  </div>
                ) : (
                  <div className="border-1 rounded-lg p-4 mb-4 w-fit">
                    <div dangerouslySetInnerHTML={{ __html: marked.parse(item.content).toString() }}></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-5 h-[22%] w-full overflow-hidden">
          <Spin spinning={loading}>
            <TextArea
              style={{padding: "10px"}}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={4}
              placeholder="输入你的问题"
              size="small"
            />
          </Spin>
          <div className="mt-2 flex justify-center items-center gap-2">
            <Button
              loading={loading}
              className="w-full flex-grow"
              onClick={chatHandlerV3}
              color="primary"
              variant="solid"
            >
              发送
            </Button>
            <Button
              disabled={!loading}
              className="w-full flex-grow"
              onClick={() => {
                ctrl.abort();
                setLoading(false);
                messageApi.info("对话终止");
              }}
              color="danger"
              variant="solid"
            >
              停止
            </Button>
            <Button
              className="w-full flex-grow"
              onClick={clearHistoryChat}
              color="gold"
              variant="solid"
            >
              清除上下文
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
