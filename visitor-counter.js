(function() {
  // Prevent duplicate execution
  if (window.CozyVisitorCounter) return;
  window.CozyVisitorCounter = true;

  // Configurations
  const TOPIC = 'jeff_bernat_cozy_lounge_presence_v1';
  const HEARTBEAT_INTERVAL = 8000;   // Send ping every 8 seconds
  const CLEANUP_INTERVAL = 2000;     // Verify active list every 2 seconds
  const OFFLINE_THRESHOLD = 20000;   // Remove users inactive for 20 seconds
  const TEXT_ROTATION_INTERVAL = 12000; // Cycle romantic messages every 12 seconds

  // Globally robust public brokers with secure WebSocket connections
  const BROKERS = [
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://broker.emqx.io:8084/mqtt',
    'wss://test.mosquitto.org:8081/mqtt'
  ];
  let currentBrokerIndex = 0;
  let client = null;
  let activeUsers = new Map(); // id -> timestamp of last seen
  let connectionTimeout = null;

  // Session-persisted ID to avoid double-counting the same user if they reload their page
  let myId = sessionStorage.getItem('cozy_lounge_visitor_id');
  if (!myId) {
    myId = 'user_' + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem('cozy_lounge_visitor_id', myId);
  }

  // UI State References
  let textIndex = 0;
  let widgetEl = null;
  let textEl = null;

  // Rotating warm/romantic Thai phrases depending on user count
  const soloMessages = [
    'คุณกำลังปล่อยใจไปกับเสียงเพลงอย่างอบอุ่นเพียงลำพัง ☕',
    'กำลังดื่มด่ำกับบรรยากาศนี้คนเดียวอย่างโรแมนติก 🌙',
    'กำลังกระซิบความรู้สึกผ่านเสียงเพลงนี้คนเดียวเงียบ ๆ ✨'
  ];

  const groupMessages = [
    'มีคนพิเศษ {count} คนกำลังแชร์ความอบอุ่นและท่วงทำนองนี้ด้วยกัน 🕯️',
    'มีคนโรแมนติก {count} คนกำลังปล่อยใจไปกับเพลงหวาน ๆ พร้อมคุณ 💕',
    'มีคนเหงาแสนน่ารัก {count} คนกำลังก้าวเข้ามาสบตากันผ่านเสียงเพลง 🌙',
    '{count} หัวใจกำลังเต้นเป็นจังหวะรักเดียวกันผ่านทำนองเพลงนี้อยู่ 💖'
  ];

  // Helper to compile text based on count
  function getRomanticText(count) {
    if (count <= 1) {
      return soloMessages[textIndex % soloMessages.length];
    } else {
      const template = groupMessages[textIndex % groupMessages.length];
      return template.replace('{count}', count);
    }
  }

  // Initialize and inject UI components dynamically
  function initUI() {
    widgetEl = document.createElement('div');
    widgetEl.className = 'visitor-counter-widget connecting';
    widgetEl.setAttribute('role', 'status');
    widgetEl.setAttribute('aria-live', 'polite');

    const dotWrapper = document.createElement('div');
    dotWrapper.className = 'visitor-status-dot-wrapper';

    const dot = document.createElement('div');
    dot.className = 'visitor-status-dot';

    const pulse = document.createElement('div');
    pulse.className = 'visitor-status-pulse';

    dotWrapper.appendChild(dot);
    dotWrapper.appendChild(pulse);

    const content = document.createElement('div');
    content.className = 'visitor-counter-content';

    textEl = document.createElement('span');
    textEl.className = 'visitor-counter-text';
    textEl.innerText = 'กำลังเชื่อมต่อคลับคนเหงา...';

    const label = document.createElement('span');
    label.className = 'visitor-counter-label';
    label.innerText = 'Cozy Lounge Status';

    content.appendChild(textEl);
    content.appendChild(label);

    widgetEl.appendChild(dotWrapper);
    widgetEl.appendChild(content);

    document.body.appendChild(widgetEl);
  }

  // Re-render and transition text smoothly
  function updateUI() {
    if (!widgetEl || !textEl) return;
    
    // Always guarantee current visitor is listed
    activeUsers.set(myId, Date.now());

    const totalCount = activeUsers.size;
    
    // Smooth micro-fade transitions
    textEl.style.opacity = '0';
    setTimeout(() => {
      textEl.innerText = getRomanticText(totalCount);
      textEl.style.opacity = '1';
    }, 200);
  }

  // Publish current user heartbeat ping
  let heartbeatTimer = null;
  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    
    // Immediately ping on join
    publishPresence('ping');

    heartbeatTimer = setInterval(() => {
      publishPresence('ping');
    }, HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }

  // Base publish wrapper
  function publishPresence(type) {
    if (!client || !client.connected) return;
    const msg = JSON.stringify({ type: type, id: myId, t: Date.now() });
    client.publish(TOPIC, msg, { qos: 0, retain: false });
  }

  // Dynamic script loader for MQTT library from CDN (resilient fallback)
  function loadMQTTLibrary(callback) {
    if (window.mqtt) {
      callback();
      return;
    }
    console.log('MQTT library not loaded. Attempting to fetch dynamically from CDN...');
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/mqtt/dist/mqtt.min.js';
    script.onload = callback;
    script.onerror = () => {
      console.error('MQTT dynamic load failed.');
      if (textEl) textEl.innerText = 'ระบบเชื่อมต่อมีปัญหา (CDN Fail) 😢';
      if (widgetEl) widgetEl.className = 'visitor-counter-widget disconnected';
    };
    document.head.appendChild(script);
  }

  // Establish connection to chosen MQTT Broker
  function connectBroker() {
    const url = BROKERS[currentBrokerIndex];
    console.log(`Connecting to cozy lounge presence at: ${url}`);
    
    if (widgetEl) {
      widgetEl.className = 'visitor-counter-widget connecting';
      textEl.innerText = 'กำลังเปิดประตูคลับ...';
    }

    // Set connection timeout limit
    if (connectionTimeout) clearTimeout(connectionTimeout);
    connectionTimeout = setTimeout(() => {
      console.warn(`Connection timeout for broker ${url}. Initiating failover...`);
      handleFallback();
    }, 5000);

    try {
      client = mqtt.connect(url, {
        keepalive: 30,
        clientId: 'cozy_client_' + Math.random().toString(16).substring(2, 8),
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 0 // Handled manually by our fallback router
      });

      client.on('connect', () => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        console.log(`Presence system connected successfully to: ${url}`);
        
        if (widgetEl) {
          widgetEl.className = 'visitor-counter-widget';
        }
        
        client.subscribe(TOPIC, (err) => {
          if (!err) {
            startHeartbeat();
            updateUI();
          } else {
            console.error('Subscription error:', err);
          }
        });
      });

      client.on('message', (topic, message) => {
        if (topic !== TOPIC) return;
        try {
          const payload = JSON.parse(message.toString());
          if (!payload.id || payload.id === myId) return;

          if (payload.type === 'ping') {
            activeUsers.set(payload.id, Date.now());
            updateUI();
          } else if (payload.type === 'disconnect') {
            activeUsers.delete(payload.id);
            updateUI();
          }
        } catch (e) {
          // Ignore parsing anomalies
        }
      });

      client.on('close', () => {
        console.log('Presence connection closed.');
        stopHeartbeat();
      });

      client.on('error', (err) => {
        console.error('Presence connection error:', err);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        handleFallback();
      });

    } catch (e) {
      console.error('Exception during presence connection:', e);
      handleFallback();
    }
  }

  // Connection failure recovery router (Fallback)
  function handleFallback() {
    if (client) {
      try {
        client.end(true);
      } catch (e) {}
    }
    
    stopHeartbeat();
    
    // Select next server in rotation
    currentBrokerIndex = (currentBrokerIndex + 1) % BROKERS.length;
    console.log(`Rotating to fallback broker index: ${currentBrokerIndex}`);
    
    // Pause briefly before reconnecting to prevent hot-looping
    setTimeout(connectBroker, 2500);
  }

  // Safe launcher helper to handle DOM state
  function onReady(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  // Run presence module
  onReady(() => {
    initUI();
    
    loadMQTTLibrary(() => {
      connectBroker();

      // Regular check for stale users who failed to send heartbeats
      setInterval(() => {
        let changed = false;
        const now = Date.now();
        activeUsers.forEach((lastSeen, userId) => {
          if (userId === myId) return; // Keep ourselves active
          if (now - lastSeen > OFFLINE_THRESHOLD) {
            activeUsers.delete(userId);
            changed = true;
          }
        });
        if (changed) {
          updateUI();
        }
      }, CLEANUP_INTERVAL);

      // Rotate text styles periodically
      setInterval(() => {
        textIndex++;
        updateUI();
      }, TEXT_ROTATION_INTERVAL);
    });

    // Notify other users on tab exit immediately
    const leaveLounge = () => {
      publishPresence('disconnect');
    };
    window.addEventListener('beforeunload', leaveLounge);
    window.addEventListener('pagehide', leaveLounge);
  });
})();
