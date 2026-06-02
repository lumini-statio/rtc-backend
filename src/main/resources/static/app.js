/**
 * LuminiCall — WebRTC client
 * Backend: Spring Boot + Netty-SocketIO (corundumstudio)
 * Events: joinRoom, ready, offer, answer, candidate, leaveRoom
 *         ← created, joined, full, setCaller, ready, offer, answer, candidate, userDisconnected
 */

'use strict';

/* ── Config ── */
const SOCKET_URL = window.location.origin;          // Nginx proxies /socket.io/ → :8000
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/* ── State ── */
let socket;
let peerConnection;
let localStream;
let currentRoom;
let isCaller = false;
let callerSocketId = null;
let timerInterval;
let timerSeconds = 0;
let micActive = true;
let camActive = true;

/* ── DOM refs ── */
const lobby       = document.getElementById('lobby');
const callRoom    = document.getElementById('callRoom');
const roomInput   = document.getElementById('roomInput');
const joinBtn     = document.getElementById('joinBtn');
const lobbyStatus = document.getElementById('lobbyStatus');
const localVideo  = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const roomLabel   = document.getElementById('roomLabel');
const callTimer   = document.getElementById('callTimer');
const waitingPH   = document.getElementById('waitingPlaceholder');
const roomPillDot = document.querySelector('.room-pill-dot');
const statusToast = document.getElementById('statusToast');

/* ────────────────────────────────────────────
   LOBBY
───────────────────────────────────────────── */
joinBtn.addEventListener('click', handleJoin);
roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleJoin(); });

async function handleJoin() {
  const room = roomInput.value.trim();
  if (!room) { setLobbyStatus('Escribe un nombre de sala.', 'error'); return; }

  setLobbyStatus('Conectando…');
  try {
    await initLocalStream();
  } catch (err) {
    setLobbyStatus('No se pudo acceder a cámara/micrófono: ' + err.message, 'error');
    return;
  }

  connectSocket(room);
}

function setLobbyStatus(msg, type = '') {
  lobbyStatus.textContent = msg;
  lobbyStatus.className = 'lobby-status ' + type;
}

/* ────────────────────────────────────────────
   MEDIA
───────────────────────────────────────────── */
async function initLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

/* ────────────────────────────────────────────
   SOCKET
───────────────────────────────────────────── */
function connectSocket(room) {
  socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[socket] connected:', socket.id);
    socket.emit('joinRoom', room);
  });

  socket.on('connect_error', (err) => {
    setLobbyStatus('Error de conexión: ' + err.message, 'error');
  });

  /* ── Room events ── */
  socket.on('created', (r) => {
    currentRoom = r;
    isCaller = true;
    showCallRoom(r);
    showToast('Sala creada. Esperando participante…');
  });

  socket.on('joined', (r) => {
    currentRoom = r;
    isCaller = false;
    showCallRoom(r);
    showToast('Sala unida. Iniciando…');
    // Notify existing peer we're ready
    socket.emit('ready', r);
  });

  socket.on('full', () => {
    setLobbyStatus('La sala está llena (máx. 2 participantes).', 'error');
    socket.disconnect();
    localStream?.getTracks().forEach((t) => t.stop());
  });

  socket.on('setCaller', (callerId) => {
    callerSocketId = callerId;
  });

  /* ── WebRTC signaling ── */
  socket.on('ready', async (r) => {
    if (isCaller) {
      // We are the original room creator → make the offer
      await createPeerConnection();
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('offer', { room: r, sdp: offer });
    }
  });

  socket.on('offer', async (sdp) => {
    await createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { room: currentRoom, sdp: answer });
  });

  socket.on('answer', async (sdp) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  });

  socket.on('candidate', async (payload) => {
    try {
      if (payload.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    } catch (e) {
      console.warn('[ice] addIceCandidate error:', e);
    }
  });

  socket.on('userDisconnected', (clientId) => {
    showToast('El otro participante se desconectó.', 'error');
    resetPeerConnection();
    waitingPH.classList.remove('hidden');
    remoteVideo.srcObject = null;
    roomPillDot.classList.remove('active');
    stopTimer();
  });

  socket.on('disconnect', () => {
    console.log('[socket] disconnected');
  });
}

/* ────────────────────────────────────────────
   WebRTC
───────────────────────────────────────────── */
async function createPeerConnection() {
  resetPeerConnection();
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  // Add local tracks
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Remote stream
  peerConnection.ontrack = (e) => {
    if (remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
      waitingPH.classList.add('hidden');
      roomPillDot.classList.add('active');
      startTimer();
      showToast('Conectado ✓');
    }
  };

  // ICE candidates
  peerConnection.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('candidate', { room: currentRoom, candidate: e.candidate });
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    const s = peerConnection?.iceConnectionState;
    console.log('[ice] state:', s);
    if (s === 'failed' || s === 'disconnected') {
      showToast('Conexión inestable…', 'error');
    }
  };
}

function resetPeerConnection() {
  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.close();
    peerConnection = null;
  }
}

/* ────────────────────────────────────────────
   UI helpers
───────────────────────────────────────────── */
function showCallRoom(room) {
  lobby.classList.add('d-none');
  callRoom.classList.remove('d-none');
  roomLabel.textContent = room;
}

let toastTimeout;
function showToast(msg, type = '') {
  statusToast.textContent = msg;
  statusToast.className = 'status-toast show ' + type;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    statusToast.classList.remove('show');
  }, 3500);
}

function startTimer() {
  timerSeconds = 0;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSeconds++;
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const s = String(timerSeconds % 60).padStart(2, '0');
    callTimer.textContent = `${m}:${s}`;
  }, 1000);
}
function stopTimer() {
  clearInterval(timerInterval);
  callTimer.textContent = '00:00';
}

/* ── Controls ── */
document.getElementById('micBtn').addEventListener('click', () => {
  micActive = !micActive;
  localStream?.getAudioTracks().forEach((t) => (t.enabled = micActive));
  toggleCtrlBtn(document.getElementById('micBtn'), micActive);
});

document.getElementById('camBtn').addEventListener('click', () => {
  camActive = !camActive;
  localStream?.getVideoTracks().forEach((t) => (t.enabled = camActive));
  toggleCtrlBtn(document.getElementById('camBtn'), camActive);
  // Black frame when off
  localVideo.style.opacity = camActive ? '1' : '0.1';
});

function toggleCtrlBtn(btn, active) {
  btn.classList.toggle('active', active);
  btn.classList.toggle('muted', !active);
  btn.querySelector('.icon-on').classList.toggle('d-none', !active);
  btn.querySelector('.icon-off').classList.toggle('d-none', active);
}

document.getElementById('hangupBtn').addEventListener('click', hangup);

function hangup() {
  socket?.emit('leaveRoom', currentRoom);
  socket?.disconnect();
  resetPeerConnection();
  stopTimer();
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;

  // Return to lobby
  callRoom.classList.add('d-none');
  lobby.classList.remove('d-none');
  waitingPH.classList.remove('hidden');
  remoteVideo.srcObject = null;
  localVideo.srcObject = null;
  roomPillDot.classList.remove('active');
  roomInput.value = '';
  setLobbyStatus('');
  micActive = true;
  camActive = true;
}

document.getElementById('fullscreenBtn').addEventListener('click', () => {
  const el = document.getElementById('videoStage');
  if (!document.fullscreenElement) {
    el.requestFullscreen().catch(console.error);
  } else {
    document.exitFullscreen();
  }
});

/* ── Draggable local PiP ── */
const localBox = document.getElementById('localBox');
let isDragging = false, dragOffX, dragOffY;

localBox.addEventListener('mousedown', (e) => {
  isDragging = true;
  localBox.style.cursor = 'grabbing';
  const rect = localBox.getBoundingClientRect();
  dragOffX = e.clientX - rect.left;
  dragOffY = e.clientY - rect.top;
});
document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const stage = document.getElementById('videoStage').getBoundingClientRect();
  let x = e.clientX - stage.left - dragOffX;
  let y = e.clientY - stage.top  - dragOffY;
  x = Math.max(0, Math.min(x, stage.width  - localBox.offsetWidth));
  y = Math.max(0, Math.min(y, stage.height - localBox.offsetHeight));
  localBox.style.right = 'auto';
  localBox.style.bottom = 'auto';
  localBox.style.left = x + 'px';
  localBox.style.top  = y + 'px';
});
document.addEventListener('mouseup', () => {
  isDragging = false;
  localBox.style.cursor = 'grab';
});
