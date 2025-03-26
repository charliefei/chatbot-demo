import {
  fetchEventSource,
  type EventSourceMessage,
} from "@microsoft/fetch-event-source";

type Options = {
  url: string;
  body?: string;
  signal?: AbortSignal;
  onopen?: (response: Response) => Promise<void>;
  onmessage?: (ev: EventSourceMessage) => void;
  onerror?: (err: any) => number | null | undefined | void;
  onclose?: () => void;
};

export default (options: Options) => {
  fetchEventSource(options.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body,
    signal: options.signal,
    onopen: options.onopen,
    onmessage: options.onmessage,
    onerror: options.onerror,
    onclose: options.onclose,
  });
};
