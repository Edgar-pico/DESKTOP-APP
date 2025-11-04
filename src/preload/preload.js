const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,

  ping: () => ipcRenderer.invoke('ping'),
  getMaterials: () => ipcRenderer.invoke('db:getMaterials'),
  vMaterialsList: (opts)       => ipcRenderer.invoke('db:vMaterials:list', opts),
  vMaterialsByPN: (partNumber) => ipcRenderer.invoke('db:vMaterials:byPN', partNumber),

  navigateToUrl: (url) => ipcRenderer.invoke('navigate-to-url', url),
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
    me: () => ipcRenderer.invoke('auth:me'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    changePassword: (oldPassword, newPassword) =>
      ipcRenderer.invoke('auth:changePassword', { oldPassword, newPassword }),
    register: (data) => ipcRenderer.invoke('auth:register', data),
  },

  app: {
    openMain: () => ipcRenderer.invoke('app:open-main'),
    openLogin: () => ipcRenderer.invoke('app:open-login'),
  },

  modal: {
    openScanRegister: (payload) => ipcRenderer.invoke('modal:scan-register-open', payload),
    // NUEVOS (evitan window.prompt)
    openMachiningCapture: (payload) => ipcRenderer.invoke('modal:machining-capture-open', payload),
    openPromptNumber: (payload) => ipcRenderer.invoke('modal:prompt-number-open', payload),
  },

  jobProcess: {
    scanRegister:   (payload) => ipcRenderer.invoke('jobProcess:scanRegister', payload),
    list:           (payload = null) => ipcRenderer.invoke('jobProcess:list', payload),
    changeStatus:   (payload) => ipcRenderer.invoke('jobProcess:changeStatus', payload),
    sendToQuality:  (payload) => ipcRenderer.invoke('jobProcess:sendToQuality', payload),
    qualityInspect: (payload) => ipcRenderer.invoke('jobProcess:qualityInspect', payload),
    sendToRework:   (payload) => ipcRenderer.invoke('jobProcess:sendToRework', payload),
    assignToMachine: (payload) => ipcRenderer.invoke('jobProcess:assignToMachine', payload),
    // NUEVOS para Maquinados
    machiningCapture: (payload) => ipcRenderer.invoke('jobProcess:machiningCapture', payload),
    sendToDeburrFromMaquinados: (payload) => ipcRenderer.invoke('jobProcess:sendToDeburrFromMaquinados', payload),
  },

  erp: {
    getJobInfo: (job) => ipcRenderer.invoke('erp:getJobInfo', job),
  },
})