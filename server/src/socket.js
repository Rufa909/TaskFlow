let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function emitTaskChanged(projectId, payload) {
  if (!ioInstance || !projectId) return;

  ioInstance.to(`project:${projectId}`).emit("taskChanged", {
    ...payload,
    projectId: Number(projectId),
  });
}

function emitProjectMessage(projectId, message) {
  if (!ioInstance || !projectId) return;

  ioInstance.to(`project:${projectId}`).emit("projectMessage", {
    projectId: Number(projectId),
    message,
  });
}

function emitWorkflowChanged(projectId, payload) {
  if (!ioInstance || !projectId) return;

  ioInstance.to(`project:${projectId}`).emit("workflowChanged", {
    ...payload,
    projectId: Number(projectId),
  });
}

module.exports = {
  setIo,
  getIo,
  emitTaskChanged,
  emitProjectMessage,
  emitWorkflowChanged,
};
