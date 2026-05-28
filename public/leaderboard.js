const params = new URLSearchParams(window.location.search);
const gameCode = params.get("gameCode") || "";

const finalGameCode = document.getElementById("finalGameCode");
const leaderboardSummary = document.getElementById("leaderboardSummary");
const finalLeaderboard = document.getElementById("finalLeaderboard");

async function loadFinalLeaderboard() {
  finalGameCode.textContent = gameCode || "----";

  if (!gameCode) {
    leaderboardSummary.textContent = "Nao foi indicado nenhum codigo de sala.";
    return;
  }

  try {
    const response = await fetch(`/state?gameCode=${encodeURIComponent(gameCode)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel carregar a leaderboard.");
    }

    quizShared.renderLeaderboard(finalLeaderboard, data.room);

    const playerCount = data.room.leaderboard.length;
    leaderboardSummary.textContent =
      playerCount === 1
        ? "1 jogador terminou o quiz."
        : `${playerCount} jogadores terminaram o quiz.`;
  } catch (error) {
    leaderboardSummary.textContent = error.message;
  }
}

loadFinalLeaderboard();
