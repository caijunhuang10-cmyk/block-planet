import net from "node:net";
import os from "node:os";

const PORT = 7897;

function currentLanAddress() {
  const interfaces = os.networkInterfaces();
  const preferred = interfaces.en0 ?? [];
  const candidates = [
    ...preferred,
    ...Object.entries(interfaces)
      .filter(([name]) => name !== "en0")
      .flatMap(([, addresses]) => addresses ?? []),
  ];
  return (
    candidates.find(
      (address) => address.family === "IPv4" && !address.internal,
    )?.address ?? "127.0.0.1"
  );
}

const server = net.createServer((client) => {
  const upstream = net.createConnection({
    host: currentLanAddress(),
    port: PORT,
  });
  client.pipe(upstream);
  upstream.pipe(client);
  const close = () => {
    client.destroy();
    upstream.destroy();
  };
  client.on("error", close);
  upstream.on("error", close);
});

server.listen({ host: "::1", port: PORT, ipv6Only: true });

