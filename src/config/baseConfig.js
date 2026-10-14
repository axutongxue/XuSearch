(function initBaseConfig() {
  const config = {
    appName: "XuSearch - 虚空搜索",
    defaultColumns: 1,
    
    
    embedTimeoutMs: 25000,
    
    
    postLoadSendDelayMs: 150,
    
    
    
    
    tabSendRetryCount: 30,
    tabSendRetryDelayMs: 2000,
    
    
    iframeStaggerMs: 80,
    
    
    
    sendConcurrency: 20,
    
    
    
    
    
    
    
    iframeMaxConcurrent: 6,
    debug: true
  };

  globalThis.XUSEARCH_BASE_CONFIG = config;
})();
