const displayState = {
  gameCode: new URLSearchParams(window.location.search).get("gameCode") || "",
  lastEventId: 0,
};

const displayElements = {
  question: document.getElementById("displayQuestion"),
  questionNumber: document.getElementById("displayQuestionNumber"),
  answered: document.getElementById("displayAnswered"),
  active: document.getElementById("displayActive"),
  leaderboard: document.getElementById("displayLeaderboard"),
  lobby: document.getElementById("displayLobby"),
  gameCode: document.getElementById("displayGameCode"),
  qr: document.getElementById("displayQr"),
};

function renderLobby(room) {
  displayElements.active.classList.add("hidden");
  displayElements.leaderboard.classList.add("hidden");
  displayElements.lobby.classList.remove("hidden");
  displayElements.gameCode.textContent = room.gameCode;

  const joinUrl = `https://jogocidadania-1.onrender.com/j/${encodeURIComponent(room.gameCode)}`;

  displayElements.qr.innerHTML = "";
  new QRCode(displayElements.qr, {
    text: joinUrl,
    width: 240,
    height: 240,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function renderLeaderboard(leaderboard) {
  displayElements.leaderboard.innerHTML = "";
  const medals = ["🥇", "🥈", "🥉"];
  leaderboard.slice(0, 5).forEach((player, index) => {
    const item = document.createElement("li");
    item.className = `display-lb-item place-${index + 1}`;
    item.innerHTML = `
      <span class="lb-medal">${medals[index] || (index + 1) + "."}</span>
      <strong class="lb-name">${player.name}</strong>
      <span class="lb-score">${player.score} pts</span>
    `;
    displayElements.leaderboard.appendChild(item);
  });
}

function renderDisplay(room) {
  if (!room) return;

  if (room.state === "finished") {
    displayElements.lobby.classList.add("hidden");
    displayElements.active.classList.add("hidden");
    displayElements.question.textContent = "Jogo terminado!";
    renderLeaderboard(room.leaderboard || []);
    displayElements.leaderboard.classList.remove("hidden");
    return;
  }

  if (!room.currentQuestion) {
    renderLobby(room);
    return;
  }

  displayElements.lobby.classList.add("hidden");
  displayElements.leaderboard.classList.add("hidden");
  displayElements.active.classList.remove("hidden");

  const totalPlayers = room.leaderboard.length;
  const answeredPlayers = room.leaderboard.filter((p) => p.answeredCurrent).length;

  displayElements.question.textContent = room.currentQuestion.text;
  displayElements.questionNumber.textContent = `Pergunta ${room.questionIndex + 1} de ${room.totalQuestions}`;
  displayElements.answered.textContent = `${answeredPlayers}/${totalPlayers}`;
}

async function loadInitialState() {
  if (!displayState.gameCode) {
    displayElements.question.textContent = "Código da sala em falta.";
    return;
  }
  const response = await fetch(`/state?gameCode=${encodeURIComponent(displayState.gameCode)}`);
  const data = await response.json();
  renderDisplay(data.room);
}

async function pollDisplayUpdates() {
  while (displayState.gameCode) {
    try {
      const response = await fetch(
        `/updates?gameCode=${encodeURIComponent(displayState.gameCode)}&since=${displayState.lastEventId}`
      );
      const data = await response.json();
      (data.events || []).forEach((event) => {
        displayState.lastEventId = Math.max(displayState.lastEventId, event.id);
        if (event.payload?.room) renderDisplay(event.payload.room);
      });
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

loadInitialState().then(pollDisplayUpdates).catch(() => {
  displayElements.question.textContent = "Não foi possível carregar a sala.";
});
