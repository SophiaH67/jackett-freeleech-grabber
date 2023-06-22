import "dotenv/config";
import { JackettApi } from "ts-jackett-api";

if (!process.env.QBIT_URL) {
  throw new Error("QBit URL not set");
}

if (!process.env.JACKETT_URL || !process.env.JACKETT_API_KEY) {
  throw new Error("Jackett URL or API key not set");
}

const jackett = new JackettApi(
  process.env.JACKETT_URL,
  process.env.JACKETT_API_KEY
);

async function main() {
  const { QBittorrent } = await (eval('import("@ctrl/qbittorrent")') as Promise<
    typeof import("@ctrl/qbittorrent")
  >);

  const qbit = new QBittorrent({
    baseUrl: process.env.QBIT_URL,
    username: process.env.QBIT_USERNAME || "admin",
    password: process.env.QBIT_PASSWORD || "adminadmin",
  });

  const { Results } = await jackett.search({
    query: "",
    tracker: ["torrentleech"],
  });

  const oneHourAgo = new Date(Date.now() - 3_600_000 * 8);

  const torrents = Results
    // Get torrents from the last hour
    .filter((result) => new Date(result.PublishDate) > oneHourAgo)
    // Only get torrents with 0 download volume factor (freeleech)
    .filter((result) => result.DownloadVolumeFactor === 0)
    // Only get torrents less 10GB
    .filter((result) => result.Size < 10 * 1024 * 1024 * 1024);

  for (const torrent of torrents) {
    console.log(`Adding ${torrent.Title} to qbit`);

    const torrentFileContent = await fetch(torrent.Link).then((res) =>
      res.arrayBuffer()
    );

    const success = await qbit
      //@ts-expect-error - Frick you qbit person
      .addTorrent(torrentFileContent, {
        category: "freeleech",
        useAutoTMM: "true",
      })
      .catch(() => false);

    if (!success) console.log("Failed to add torrent", torrent.Title);
  }
}

(async () => {
  while (true) {
    await main();
    // Wait 5 minutes
    await new Promise((resolve) => setTimeout(resolve, 300_000));
  }
})();
