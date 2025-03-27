import { useState } from "react";
import { Input, Button, Spin } from "antd";
import fetchEventStream from "./api/sse.ts";

let v1 = "http://192.168.6.2:3015/ai/chat/stream?query=";
let v2 = "http://192.168.6.2:3015/ai/chat/stream/v2?query=";
let v3 = "http://192.168.6.2:3015/ai/chat/stream/v3";
const { TextArea } = Input;

function App() {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [content, setContent] = useState("");

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
      body: JSON.stringify({
        query,
      }),
      onmessage(ev) {
        if (ev.event === "message") {
          const decodedData = ev.data
            .replace(/\\n/g, "<br/>")
            .replace(/\\:/g, ":")
            .replace(/&nbsp;/g, " ");
          buffer += decodedData;
          setContent(buffer);
        }
      },
      onclose() {
        // 最终将markdown文本转换为html展示
        console.log("close", buffer.replace(/<br\/>/g, "\n"));
        setQuery("");
        setLoading(false);
      },
      async onopen(response) {
        console.log("open", response.ok);
      },
      onerror(err) {
        console.log("error", err);
        setQuery("");
        setLoading(false);
      },
    });
  };

  return (
    <>
      <div className="p-5 h-[20vh]">
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
      <div className="m-2 p-5 border-1 rounded-lg border-slate-400 overflow-auto h-[70vh]">
        <Spin spinning={loading}>
          <div dangerouslySetInnerHTML={{ __html: content }}></div>
        </Spin>
      </div>
    </>
  );
}

export default App;
