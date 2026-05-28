const hostState = {
  gameCode: "",
  room: null,
  lastEventId: 0,
  pollingActive: false,
  displayWindow: null,
};

const hostElements = {
  createRoomForm: document.getElementById("createRoomForm"),
  hostControls: document.getElementById("hostControls"),
  hostGameCode: document.getElementById("hostGameCode"),
  roomState: document.getElementById("roomState"),
  startGameBtn: document.getElementById("startGameBtn"),
  nextQuestionBtn: document.getElementById("nextQuestionBtn"),
  displayLink: document.getElementById("displayLink"),
  questionTitle: document.getElementById("questionTitle"),
  questionMeta: document.getElementById("questionMeta"),
  leaderboard: document.getElementById("leaderboard"),
  activityLog: document.getElementById("activityLog"),
  timerValue: document.getElementById("timerValue"),
  answeredValue: document.getElementById("answeredValue"),
  connectionStatus: document.getElementById("connectionStatus"),
};

function updateAnsweredCounter(room) {
  if (!room || room.state !== "playing") {
    hostElements.answeredValue.textContent = "--";
    return;
  }

  const totalPlayers = room.leaderboard.length;
  const answeredPlayers = room.leaderboard.filter((player) => player.answeredCurrent).length;
  hostElements.answeredValue.textContent = `${answeredPlayers}/${totalPlayers}`;
}

function renderHostRoom(room) {
  hostState.room = room;
  if (!room) {
    return;
  }

  hostElements.roomState.textContent = room.state;
  quizShared.renderLeaderboard(hostElements.leaderboard, room);
  updateAnsweredCounter(room);

  if (room.state === "finished") {
    hostElements.questionTitle.textContent = "Jogo terminado";
    hostElements.questionMeta.textContent = "Leaderboard final com todos os jogadores e pontos.";
  } else {
    hostElements.questionTitle.textContent = room.currentQuestion
      ? room.currentQuestion.text
      : "Aguardando criacao da sala";
    hostElements.questionMeta.textContent = room.currentQuestion
      ? `Pergunta ${room.questionIndex + 1} de ${room.totalQuestions}`
      : "Partilha o codigo com os jogadores para comecarem a entrar.";
  }

  hostElements.startGameBtn.disabled = room.state !== "lobby" || room.leaderboard.length === 0;
  const canAdvance = room.state === "playing" || room.state === "revealing";
  hostElements.nextQuestionBtn.classList.toggle("hidden", !canAdvance);
  hostElements.nextQuestionBtn.disabled = !canAdvance;
}

function handleHostEvent(event) {
  hostState.lastEventId = Math.max(hostState.lastEventId, event.id);

  if (event.payload?.room) {
    renderHostRoom(event.payload.room);
  }

  switch (event.type) {
    case "room-created":
      quizShared.logActivity(hostElements.activityLog, "Sala criada.");
      break;
    case "player-joined":
      quizShared.logActivity(hostElements.activityLog, `${event.payload.player.name} entrou na sala.`);
      break;
    case "question-started":
      quizShared.logActivity(hostElements.activityLog, "Nova pergunta iniciada.");
      break;
    case "question-ended":
      quizShared.logActivity(
        hostElements.activityLog,
        `Pergunta terminada. Resposta correta: ${event.payload.correctAnswer}`
      );
      break;
    case "game-finished":
      quizShared.logActivity(hostElements.activityLog, "Jogo terminado.");
      quizShared.goToLeaderboard(hostState.gameCode);
      break;
    default:
      break;
  }
}

async function pollHostUpdates() {
  if (!hostState.gameCode || hostState.pollingActive) {
    return;
  }

  hostState.pollingActive = true;
  quizShared.updateConnectionStatus(hostElements.connectionStatus, "Ligado. A escutar atualizacoes...");

  while (hostState.gameCode) {
    try {
      const response = await fetch(
        `/updates?gameCode=${encodeURIComponent(hostState.gameCode)}&since=${hostState.lastEventId}`
      );
      const data = await response.json();
      quizShared.syncServerTime(data.serverTime);
      (data.events || []).forEach(handleHostEvent);
      quizShared.updateConnectionStatus(hostElements.connectionStatus, "Ligado. A escutar atualizacoes...");
    } catch (error) {
      quizShared.updateConnectionStatus(
        hostElements.connectionStatus,
        "Falha na ligacao. A tentar novamente..."
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  hostState.pollingActive = false;
}

hostElements.createRoomForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const displayWindow = window.open("", "_blank");

  try {
    const hostName = document.getElementById("hostName").value.trim();
    const data = await quizShared.api("/create-room", { hostName });
    hostState.gameCode = data.gameCode;
    hostState.displayWindow = displayWindow;
    hostElements.hostControls.classList.remove("hidden");
    hostElements.hostGameCode.textContent = data.gameCode;
    hostElements.displayLink.href = `/display?gameCode=${encodeURIComponent(data.gameCode)}`;
    hostElements.displayLink.classList.remove("hidden");
    localStorage.setItem("quiz-host-game-code", data.gameCode);
    if (displayWindow) {
      displayWindow.location.href = `/display?gameCode=${encodeURIComponent(data.gameCode)}`;
    }
    renderHostRoom(data.room);
    quizShared.logActivity(hostElements.activityLog, `Sala ${data.gameCode} pronta para receber jogadores.`);
    pollHostUpdates();
  } catch (error) {
    if (displayWindow) {
      displayWindow.close();
    }
    alert(error.message);
  }
});

hostElements.startGameBtn.addEventListener("click", async () => {
  const displayWindow =
    hostState.displayWindow && !hostState.displayWindow.closed
      ? hostState.displayWindow
      : window.open("", "_blank");

  try {
    await quizShared.api("/start", { gameCode: hostState.gameCode });
    hostState.displayWindow = displayWindow;
    if (displayWindow) {
      displayWindow.location.href = `/display?gameCode=${encodeURIComponent(hostState.gameCode)}`;
    }
    quizShared.logActivity(hostElements.activityLog, "Jogo iniciado pelo anfitriao.");
  } catch (error) {
    if (displayWindow) {
      displayWindow.close();
    }
    alert(error.message);
  }
});

function shouldWarnBeforeNextQuestion() {
  const room = hostState.room;
  if (!room || room.state !== "playing") {
    return false;
  }

  const totalPlayers = room.leaderboard.length;
  const answeredPlayers = room.leaderboard.filter((player) => player.answeredCurrent).length;
  const timeStillRunning = room.deadlineAt && room.deadlineAt > Date.now();
  const playersStillAnswering = answeredPlayers < totalPlayers;

  return Boolean(timeStillRunning || playersStillAnswering);
}

hostElements.nextQuestionBtn.addEventListener("click", async () => {
  if (shouldWarnBeforeNextQuestion() && !confirm("Tem a certeza?")) {
    return;
  }

  try {
    await quizShared.api("/next-question", { gameCode: hostState.gameCode });
    quizShared.logActivity(hostElements.activityLog, "Pergunta seguinte enviada.");
  } catch (error) {
    alert(error.message);
  }
});

quizShared.startTimerLoop(() => hostState.room?.deadlineAt, hostElements.timerValue);
