(function () {
  let serverTimeOffset = 0;

  function syncServerTime(serverTime) {
    if (Number.isFinite(serverTime)) {
      serverTimeOffset = serverTime - Date.now();
    }
  }

  function getSyncedNow() {
    return Date.now() + serverTimeOffset;
  }

  function getRemainingSeconds(deadlineAt) {
    return Math.max(0, Math.ceil((deadlineAt - getSyncedNow()) / 1000));
  }

  function api(path, payload) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Pedido falhou.");
      }
      syncServerTime(data.serverTime);
      return data;
    });
  }

  function updateConnectionStatus(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  function logActivity(listElement, message) {
    if (!listElement) {
      return;
    }

    const item = document.createElement("li");
    item.textContent = `${new Date().toLocaleTimeString("pt-PT")} - ${message}`;
    listElement.prepend(item);
  }

  function renderLeaderboard(listElement, room) {
    if (!listElement) {
      return;
    }

    listElement.innerHTML = "";
    listElement.classList.toggle("is-final", room?.state === "finished");

    const leaderboard = room?.leaderboard || [];
    if (leaderboard.length === 0) {
      const item = document.createElement("li");
      item.textContent = "Ainda nao ha jogadores.";
      listElement.appendChild(item);
      return;
    }

    leaderboard.forEach((player, index) => {
      const item = document.createElement("li");
      const rank = document.createElement("span");
      const name = document.createElement("strong");
      const score = document.createElement("span");

      rank.className = "leaderboard-rank";
      name.className = "leaderboard-name";
      score.className = "leaderboard-score";

      rank.textContent = `${index + 1}.`;
      name.textContent = player.name;
      score.textContent = `${player.score} pts`;

      item.append(rank, name, score);
      listElement.appendChild(item);
    });
  }

  function goToLeaderboard(gameCode) {
    if (!gameCode) {
      return;
    }

    window.location.href = `/leaderboard?gameCode=${encodeURIComponent(gameCode)}`;
  }

  function startTimerLoop(getDeadlineAt, timerElement) {
    setInterval(() => {
      const deadlineAt = getDeadlineAt();
      if (!deadlineAt) {
        timerElement.textContent = "--";
        timerElement.parentElement?.classList.remove("timer-warning");
        return;
      }

      const seconds = getRemainingSeconds(deadlineAt);
      timerElement.textContent = `${seconds}s`;
      timerElement.parentElement?.classList.toggle("timer-warning", seconds > 0 && seconds <= 5);
    }, 250);
  }

  window.quizShared = {
    api,
    getRemainingSeconds,
    goToLeaderboard,
    logActivity,
    renderLeaderboard,
    startTimerLoop,
    syncServerTime,
    updateConnectionStatus,
  };
})();
