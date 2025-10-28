const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,


  ping: () => ipcRenderer.invoke('ping'),
  getMaterials: () => ipcRenderer.invoke('db:getMaterials'),
  vMaterialsList: (opts)       => ipcRenderer.invoke('db:vMaterials:list', opts),
  vMaterialsByPN: (partNumber) => ipcRenderer.invoke('db:vMaterials:byPN', partNumber),



  // también podemos exponer variables, no solo funciones
  navigateToUrl: (url) => ipcRenderer.invoke('navigate-to-url', url),
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
    me: () => ipcRenderer.invoke('auth:me'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    changePassword: (oldPassword, newPassword) =>
      ipcRenderer.invoke('auth:changePassword', { oldPassword, newPassword }),
    register: (data) => ipcRenderer.invoke('auth:register', data), // opcional
  },


  app: {
    openMain: () => ipcRenderer.invoke('app:open-main'),
    openLogin: () => ipcRenderer.invoke('app:open-login'),
  },

    modal: {
    openScanRegister: (payload) => ipcRenderer.invoke('modal:scan-register-open', payload),
  },

  // NUEVO: SP desde la vista Deburr (renderer principal)
  jobProcess: {
    scanRegister: (payload) => ipcRenderer.invoke('jobProcess:scanRegister', payload),
  },

  // Opcional: también puedes exponer ERP aquí si lo quieres en otras vistas
  erp: {
    getJobInfo: (job) => ipcRenderer.invoke('erp:getJobInfo', job),
  },

})