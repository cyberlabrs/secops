// Pokretanje lab okruženja; koriste ga server i scripts/check-content.js.
// Običan kurs: jedan kontejner bez mreže. Kurs sa lab.nodes (npr. CKA): po jedan privilegovani
// kontejner za svaki čvor (systemd + containerd + kubelet, kao kind) na zasebnoj Docker mreži.
import crypto from "node:crypto";
import { PassThrough } from "node:stream";
import { execFileSync } from "node:child_process";
import Docker from "dockerode";

// Colima, OrbStack i Docker Desktop drže socket na različitim mjestima;
// isti socket koji koristi `docker` CLI uzimamo iz aktivnog konteksta.
function dockerOptions() {
  if (process.env.DOCKER_HOST) return undefined;
  try {
    const host = execFileSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { encoding: "utf8" }).trim();
    if (host.startsWith("unix://")) return { socketPath: host.slice(7) };
  } catch {}
  return undefined;
}
export const docker = new Docker(dockerOptions());

export function execRun(container, script, timeoutMs = 30000) {
  return new Promise(async (resolve) => {
    try {
      const exec = await container.exec({
        Cmd: ["bash", "-c", script], AttachStdout: true, AttachStderr: true, Tty: false,
        Env: ["TERM=dumb", "HOME=/root", "KUBECONFIG=/root/.kube/config"], WorkingDir: "/root",
      });
      const stream = await exec.start({ hijack: true, stdin: false });
      let out = "";
      const sink = new PassThrough();
      sink.on("data", (d) => { if (out.length < 20000) out += d.toString(); });
      docker.modem.demuxStream(stream, sink, sink);
      const timer = setTimeout(() => { stream.destroy(); resolve({ code: 124, out: out + "\n[istek vremena]" }); }, timeoutMs);
      stream.on("end", async () => {
        clearTimeout(timer);
        const info = await exec.inspect();
        resolve({ code: info.ExitCode ?? 1, out });
      });
    } catch (e) {
      resolve({ code: 1, out: String(e.message || e) });
    }
  });
}

// Vraća { primary, containers, user, remove() }. Terminal, setup i provjere idu na primary (prvi čvor).
export async function createLabEnv(lab, labels) {
  if (!lab.nodes?.length) {
    const container = await docker.createContainer({
      Image: lab.image, Cmd: ["sleep", "infinity"], Hostname: "lab", Tty: false, Labels: labels,
      // dodatne capabilities (npr. NET_ADMIN za firewall lab) važe samo u izolovanom mrežnom prostoru kontejnera
      HostConfig: { NetworkMode: "none", Memory: (lab.memoryMB || 768) * 1024 * 1024, PidsLimit: lab.pids || 512, AutoRemove: true, CapAdd: lab.caps || [] },
    });
    await container.start();
    return { primary: container, containers: [container], user: "root@lab", remove: () => container.remove({ force: true }).catch(() => {}) };
  }

  // zasebna bridge mreža po labu: čvorovi se vide po imenu (controlplane, node01).
  // Ne "Internal": Docker tada odbacuje pakete sa pod IP adresama (10.244.x) između čvorova.
  // Slike ionako dolaze samo iz lokalnog mirrora na čvoru (containerd certs.d), pa lab ne zavisi od interneta.
  const netName = "kurs-lab-" + crypto.randomBytes(4).toString("hex");
  const network = await docker.createNetwork({ Name: netName, Labels: labels });
  const containers = [];
  const remove = async () => {
    await Promise.all(containers.map((c) => c.remove({ force: true, v: true }).catch(() => {})));
    await network.remove().catch(() => {});
  };
  try {
    for (const [i, name] of lab.nodes.entries()) {
      const c = await docker.createContainer({
        Image: lab.image, Hostname: name, Tty: true, Labels: { ...labels, "kurs.node": name },
        Volumes: { "/var": {} },
        HostConfig: {
          Privileged: true, NetworkMode: netName, CgroupnsMode: "private",
          SecurityOpt: ["seccomp=unconfined", "apparmor=unconfined"],
          Tmpfs: { "/run": "rw", "/tmp": "rw" }, Binds: ["/lib/modules:/lib/modules:ro", "/boot:/boot:ro"],
          Memory: (i === 0 ? 3072 : 2048) * 1024 * 1024,
        },
        NetworkingConfig: { EndpointsConfig: { [netName]: { Aliases: [name] } } },
      });
      containers.push(c);
      await c.start();
    }
  } catch (e) {
    await remove();
    throw e;
  }
  return { primary: containers[0], containers, user: `root@${lab.nodes[0]}`, remove };
}

// Uklanja zaostale kontejnere i mreže sa datom oznakom (npr. poslije pada servera).
export async function cleanupLabels(label) {
  const list = await docker.listContainers({ all: true, filters: { label: [label] } });
  await Promise.all(list.map((c) => docker.getContainer(c.Id).remove({ force: true, v: true }).catch(() => {})));
  const nets = await docker.listNetworks({ filters: { label: [label] } });
  await Promise.all(nets.map((n) => docker.getNetwork(n.Id).remove().catch(() => {})));
  return list.length;
}
