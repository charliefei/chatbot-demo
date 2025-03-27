import { useState, useEffect, useRef } from "react";
import { Input, Button, Spin } from "antd";
import fetchEventStream, { RetriableError, FatalError } from "./api/sse.ts";
import { EventStreamContentType } from "@microsoft/fetch-event-source";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

let v1 = "http://192.168.6.2:3015/ai/chat/stream?query=";
let v2 = "http://192.168.6.2:3015/ai/chat/stream/v2?query=";
let v3 = "http://localhost:3015/ai/chat/stream/v3";
const { TextArea } = Input;
const ctrl = new AbortController();
const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs border-1 w-[50vw] rounded-lg language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);

function App() {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [content, setContent] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // useEffect(() => {
  //   contentRef.current!.scrollTo({
  //     top: document.documentElement.scrollHeight,
  //     behavior: "smooth",
  //   });
  // }, [content]);
  const scrollToBottom = () => {
    contentRef.current!.scrollTop = contentRef.current!.scrollHeight;
  };

  const chatHandler = () => {
    setLoading(true);
    setContent("");
    const eventSource = new EventSource(v2 + encodeURIComponent(query));
    setQuery("");

    let buffer = "";

    eventSource.onmessage = (e) => {
      const decodedData = e.data
        .replace(/\\n/g, "<br/>") // 还原换行符
        .replace(/\\:/g, ":"); // 还原冒号

      buffer += decodedData;
      setContent(buffer);
    };

    eventSource.addEventListener("end", (e) => {
      console.log("onend: ", e.data);
      // 最终将markdown文本转换为html展示
      eventSource.close();
      setLoading(false);
    });

    eventSource.onerror = (e) => {
      console.log("onerror: ", e);
      eventSource.close();
      setLoading(false);
    };
  };

  const chatHandlerV3 = () => {
    setLoading(true);
    setContent("");
    let buffer = "";
    fetchEventStream({
      url: v3,
      signal: ctrl.signal,
      body: JSON.stringify({
        query,
      }),
      onmessage(ev) {
        if (ev.event === "message") {
          const decodedData = ev.data
            .replace(/\\n/g, "\n")
            .replace(/\\:/g, ":")
            .replace(/&nbsp;/g, " ");
          buffer += decodedData;
          // setContent(buffer);
          setContent(marked.parse(buffer).toString());
          scrollToBottom()
        }
        if (ev.event === "end") {
          // 最终将markdown文本转换为html展示
          // setContent(marked.parse(buffer).toString());
          console.log("end", buffer);
          setQuery("");
          setLoading(false);
          scrollToBottom()
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
          throw err;
        }
        console.log("RetriableError", err);
      },
    });
  };

  return (
    <>
      <div className="p-5 h-[25vh]">
        <TextArea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={4}
          placeholder="input your question here..."
          size="small"
        />
        <Button
          loading={loading}
          className="mt-2 w-full"
          onClick={chatHandlerV3}
          color="cyan"
          variant="solid"
        >
          Send
        </Button>
      </div>
      <hr />
      <div
        ref={contentRef}
        className="m-2 p-5 border-1 rounded-lg border-slate-400 overflow-auto h-[70vh]"
      >
        <Spin spinning={loading}>
          <div dangerouslySetInnerHTML={{ __html: content }}></div>
        </Spin>
      </div>
    </>
  );
}

export default App;
