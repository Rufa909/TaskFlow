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

module.exports = {
  setIo,
  getIo,
  emitTaskChanged,
};
