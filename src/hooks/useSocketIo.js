import { useEffect, useMemo, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

export default function useSocketIo({
  onTaskChanged,
  projectIds = [],
  enabled = true,
} = {}) {
  const socketRef = useRef(null);

  const normalizedProjectIds = useMemo(() => {
    if (!Array.isArray(projectIds)) return [];
    return [...new Set(projectIds.map((id) => Number(id)).filter(Boolean))];
  }, [projectIds]);

  useEffect(() => {
    if (!enabled) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      // Join all current rooms
      for (const projectId of normalizedProjectIds) {
        socket.emit("joinProject", projectId);
      }
    });

    socket.on("taskChanged", (payload) => {
      if (typeof onTaskChanged === "function") {
        onTaskChanged(payload);
      }
    });

    return () => {
      socket.removeAllListeners("taskChanged");
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, normalizedProjectIds.join(","), onTaskChanged]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !enabled) return;

    // When projectIds change, join new rooms
    for (const projectId of normalizedProjectIds) {
      socket.emit("joinProject", projectId);
    }
  }, [enabled, normalizedProjectIds]);

  return socketRef;
}

