import { useState } from "react";
import { Input, Button, Spin } from "antd";

let url = "http://192.168.6.2:3015/ai/chat/stream/v2?query=";
const { TextArea } = Input;

function App() {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [content, setContent] = useState("");

  const chatHandler = () => {
    setLoading(true);
    setContent("");
    const eventSource = new EventSource(url + encodeURIComponent(query));
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
          onClick={chatHandler}
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
