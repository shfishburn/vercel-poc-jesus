import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTtsPlayer } from "@/hooks/useTtsPlayer";

class FakeAudio {
  src = "";
  muted = false;
  private listeners = new Map<string, Array<() => void>>();

  play() {
    return Promise.resolve();
  }

  pause() {}

  load() {
    for (const listener of this.listeners.get("canplaythrough") ?? []) listener();
  }

  addEventListener(event: string, listener: () => void) {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, listener]);
  }
}

const SUPABASE_URL = "https://project.supabase.co";
const PUBLISHABLE_KEY = "publishable-test-key";

const options = {
  text: "Dearly beloved, we are gathered here today.",
  department: "complaints",
  faith: "christianity",
  type: "prayer" as const,
};

const audioResponse = () => new Response("mp3-bytes", { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubEnv("VITE_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE_KEY);
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("useTtsPlayer", () => {
  it("performs zero fetches on mount", () => {
    const { result } = renderHook(() => useTtsPlayer(options));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
  });

  it("fetches exactly once on the first play, with the tts request body", async () => {
    fetchMock.mockResolvedValueOnce(audioResponse());
    const { result } = renderHook(() => useTtsPlayer(options));

    await act(async () => {
      await result.current.handlePlay();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/tts`);
    expect(url.endsWith("/functions/v1/tts")).toBe(true);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    });
    expect(JSON.parse(init.body as string)).toEqual({
      text: options.text,
      department: options.department,
      faith: options.faith,
      type: "prayer",
    });
    expect(result.current.state).toBe("playing");
  });

  it("omits type from the body when none is given", async () => {
    fetchMock.mockResolvedValueOnce(audioResponse());
    const { text, department, faith } = options;
    const { result } = renderHook(() => useTtsPlayer({ text, department, faith }));

    await act(async () => {
      await result.current.handlePlay();
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ text, department, faith });
  });

  it("replays from the cached blob without a second fetch", async () => {
    fetchMock.mockResolvedValueOnce(audioResponse());
    const { result } = renderHook(() => useTtsPlayer(options));

    await act(async () => {
      await result.current.handlePlay();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.handlePlay();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe("playing");
  });

  it("fetches again after a failed play, because nothing was cached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(audioResponse());
    const { result } = renderHook(() => useTtsPlayer(options));

    await act(async () => {
      await result.current.handlePlay();
    });
    expect(result.current.state).toBe("error");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.handlePlay();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe("playing");
  });

  it("does not start a second fetch while the first is still loading", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const { result } = renderHook(() => useTtsPlayer(options));

    let firstPlay: Promise<void> = Promise.resolve();
    act(() => {
      firstPlay = result.current.handlePlay();
    });
    expect(result.current.state).toBe("loading");

    await act(async () => {
      await result.current.handlePlay();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(audioResponse());
      await firstPlay;
    });
    expect(result.current.state).toBe("playing");
  });

  it("never fetches when disabled, and fetches once when not", async () => {
    fetchMock.mockResolvedValue(audioResponse());

    const disabled = renderHook(() => useTtsPlayer({ ...options, disabled: true }));
    await act(async () => {
      await disabled.result.current.handlePlay();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(disabled.result.current.state).toBe("idle");

    const enabled = renderHook(() => useTtsPlayer({ ...options, disabled: false }));
    await act(async () => {
      await enabled.result.current.handlePlay();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enters the error state on a non-OK response and never loads audio", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response("upstream failed", { status: 502 }));
    const { result } = renderHook(() => useTtsPlayer(options));

    await act(async () => {
      await result.current.handlePlay();
    });

    expect(result.current.state).toBe("error");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("enters the error state on an empty audio body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
    const { result } = renderHook(() => useTtsPlayer(options));

    await act(async () => {
      await result.current.handlePlay();
    });

    expect(result.current.state).toBe("error");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
