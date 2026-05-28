const playerState = {
  gameCode: "",
  playerId: "",
  playerName: "",
  room: null,
  selectedAnswer: null,
  lastEventId: 0,
  pollingActive: false,
};

const playerElements = {
  hero: document.getElementById("playerHero"),
  joinForm: document.getElementById("joinForm"),
  joinPanel: document.getElementById("joinPanel"),
  playerPanels: document.getElementById("playerPanels"),
  playerSummary: document.getElementById("playerSummary"),
  playerSummaryName: document.getElementById("playerSummaryName"),
  playerSummaryCode: document.getElementById("playerSummaryCode"),
  questionTitle: document.getElementById("questionTitle"),
  questionMeta: document.getElementById("questionMeta"),
  answerFeedback: document.getElementById("answerFeedback"),
  answerOptions: document.getElementById("answerOptions"),
  finalResult: document.getElementById("playerFinalResult"),
  finalPlayerName: document.getElementById("finalPlayerName"),
  finalPosition: document.getElementById("finalPosition"),
  finalScore: document.getElementById("finalScore"),
  activityLog: document.getElementById("activityLog"),
  timerValue: document.getElementById("timerValue"),
  pointsValue: document.getElementById("pointsValue"),
  connectionStatus: document.getElementById("connectionStatus"),
};

function clearAnswerFeedback() {
  playerElements.answerFeedback.className = "answer-feedback hidden";
  playerElements.answerFeedback.textContent = "";
}

function showAnswerFeedback(isCorrect, pointsGained) {
  playerElements.answerFeedback.className = isCorrect
    ? "answer-feedback is-correct"
    : "answer-feedback is-wrong";
  playerElements.answerFeedback.textContent = isCorrect
    ? `Resposta certa! Ganhaste ${pointsGained} pontos nesta pergunta.`
    : "Resposta enviada.";
}

function renderPlayerQuestion(room) {
  playerElements.answerOptions.innerHTML = "";

  if (room?.state === "finished") {
    return;
  }

  if (!room?.currentQuestion) {
    playerElements.questionTitle.textContent = "Aguardando entrada na sala";
    playerElements.questionMeta.textContent = "Quando o anfitriao iniciar, a pergunta aparece aqui.";
    clearAnswerFeedback();
    return;
  }

  playerElements.questionTitle.textContent = room.currentQuestion.text;
  playerElements.questionMeta.textContent = `Pergunta ${room.questionIndex + 1} de ${room.totalQuestions}`;

  room.currentQuestion.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-btn";
    button.textContent = option;
    button.disabled = !playerState.playerId || room.state !== "playing";

    if (playerState.selectedAnswer === index) {
      button.classList.add("selected");
    }

    button.addEventListener("click", async () => {
      try {
        const data = await quizShared.api("/answer", {
          gameCode: playerState.gameCode,
          playerId: playerState.playerId,
          answerIndex: index,
        });
        playerState.selectedAnswer = index;
        renderPlayerRoom(data.room);
        showAnswerFeedback(data.isCorrect, data.pointsGained);
        quizShared.logActivity(
          playerElements.activityLog,
          data.isCorrect
            ? `Respondeste: ${option}. Ganhaste ${data.pointsGained} pontos.`
            : `Respondeste: ${option}.`
        );
      } catch (error) {
        alert(error.message);
      }
    });

    playerElements.answerOptions.appendChild(button);
  });
}

function renderPlayerFinalResult(room) {
  const playerIndex = (room.leaderboard || []).findIndex((player) => String(player.id) === playerState.playerId);
  if (playerIndex === -1) {
    playerElements.finalResult.classList.add("hidden");
    return;
  }

  const player = room.leaderboard[playerIndex];
  playerElements.hero.classList.add("hidden");
  playerElements.playerPanels.classList.add("hidden");
  playerElements.finalPlayerName.textContent = player.name;
  playerElements.finalPosition.textContent = `${playerIndex + 1}.`;
  playerElements.finalScore.textContent = `${player.score} pts`;
  playerElements.finalResult.classList.remove("hidden");
}

function renderPlayerRoom(room) {
  const previousQuestionIndex = playerState.room?.questionIndex;
  playerState.room = room;
  if (!room) {
    return;
  }

  if (room.questionIndex !== previousQuestionIndex || room.state !== "playing") {
    playerState.selectedAnswer = null;
    clearAnswerFeedback();
  }

  if (room.state === "finished") {
    renderPlayerFinalResult(room);
  } else {
    playerElements.hero.classList.remove("hidden");
    playerElements.playerPanels.classList.remove("hidden");
    playerElements.finalResult.classList.add("hidden");
  }
  renderPlayerQuestion(room);
}

function handlePlayerEvent(event) {
  playerState.lastEventId = Math.max(playerState.lastEventId, event.id);

  if (event.payload?.room) {
    renderPlayerRoom(event.payload.room);
  }

  switch (event.type) {
    case "player-joined":
      if (event.payload.player.id === playerState.playerId) {
        quizShared.logActivity(playerElements.activityLog, "Entraste na sala.");
      }
      break;
    case "question-started":
      playerState.selectedAnswer = null;
      clearAnswerFeedback();
      quizShared.logActivity(playerElements.activityLog, "Nova pergunta iniciada.");
      break;
    case "question-ended":
      quizShared.logActivity(
        playerElements.activityLog,
        `Tempo terminou. Resposta correta: ${event.payload.correctAnswer}`
      );
      break;
    case "game-finished":
      quizShared.logActivity(playerElements.activityLog, "Jogo terminado.");
      break;
    default:
      break;
  }
}

async function pollPlayerUpdates() {
  if (!playerState.gameCode || playerState.pollingActive) {
    return;
  }

  playerState.pollingActive = true;
  quizShared.updateConnectionStatus(playerElements.connectionStatus, "Ligado. A escutar atualizacoes...");

  while (playerState.gameCode) {
    try {
      const response = await fetch(
        `/updates?gameCode=${encodeURIComponent(playerState.gameCode)}&since=${playerState.lastEventId}`
      );
      const data = await response.json();
      quizShared.syncServerTime(data.serverTime);
      (data.events || []).forEach(handlePlayerEvent);
      quizShared.updateConnectionStatus(playerElements.connectionStatus, "Ligado. A escutar atualizacoes...");
    } catch (error) {
      quizShared.updateConnectionStatus(
        playerElements.connectionStatus,
        "Falha na ligacao. A tentar novamente..."
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  playerState.pollingActive = false;
}

playerElements.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const gameCode = document.getElementById("joinGameCode").value.trim().toUpperCase();
    const name = document.getElementById("playerName").value.trim();
    const data = await quizShared.api("/join", { gameCode, name });
    playerState.gameCode = gameCode;
    playerState.playerId = data.playerId;
    playerState.playerName = name;
    localStorage.setItem("quiz-player-game-code", gameCode);
    localStorage.setItem("quiz-player-name", name);
    playerElements.joinPanel.classList.add("hidden");
    playerElements.playerPanels.classList.add("question-only");
    playerElements.playerSummary.classList.remove("hidden");
    playerElements.playerSummaryName.textContent = name;
    playerElements.playerSummaryCode.textContent = gameCode;
    renderPlayerRoom(data.room);
    quizShared.logActivity(playerElements.activityLog, `Entraste na sala ${gameCode}.`);
    pollPlayerUpdates();
  } catch (error) {
    alert(error.message);
  }
});

const savedCode = localStorage.getItem("quiz-player-game-code");
const savedName = localStorage.getItem("quiz-player-name");
const codeFromLink = window.location.pathname.startsWith("/j/")
  ? window.location.pathname.split("/").pop()
  : new URLSearchParams(window.location.search).get("code");

if (codeFromLink || savedCode) {
  document.getElementById("joinGameCode").value = String(codeFromLink || savedCode).toUpperCase();
}
if (savedName) {
  document.getElementById("playerName").value = savedName;
}

quizShared.startTimerLoop(() => playerState.room?.deadlineAt, playerElements.timerValue);

setInterval(() => {
  const deadlineAt = playerState.room?.deadlineAt;

  if (!deadlineAt || playerState.room?.state !== "playing") {
    playerElements.pointsValue.textContent = "--";
    playerElements.pointsValue.parentElement?.classList.remove("timer-warning");
    return;
  }

  const seconds = quizShared.getRemainingSeconds(deadlineAt);
  const points = seconds > 0 ? 10 + seconds : 0;
  playerElements.pointsValue.textContent = `${points} pts`;
  playerElements.pointsValue.parentElement?.classList.toggle("timer-warning", seconds > 0 && seconds <= 5);
}, 250);
