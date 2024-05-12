const express = require("express");
const app = express();
const mediasoup = require("mediasoup");

const https = require("httpolyglot");
const fs = require("fs");

const path = require("path");

const port = 3000;

const {Server} = require("socket.io");

app.get("/", (req, res) => {
    res.send("Hello from mediasoup app!!!");
});

app.use("/sfu", express.static(path.join(__dirname, "./public")));

const options = {
    key: fs.readFileSync(path.join(__dirname, "./server/ssl/key.pem"), "utf-8"),
    cert: fs.readFileSync(path.join(__dirname, "./server/ssl/cert.pem"), "utf-8"),
    passphrase: "kanyanyakaddu"
}

const httpsServer = https.createServer(options, app);
httpsServer.listen(port, () => {
    console.log(`listening on port: ${port}`);
});

const io = new Server(httpsServer);

const peers = io.of("/mediasoup");


let worker;
let router;
let producer;
let producerTransport;
let consumerTransport;
let consumer;

const createWorker = async () => {
    worker = await mediasoup.createWorker({
        rtcMinPort: 2000,
        rtcMaxPort: 2020
    });

    console.log(`worker pid ${worker.pid}`);

    worker.on("died", error => {
        console.log("mediasoup worker has died");
        setTimeout(() => process.exit(1), 2000);//exit in 2 seconds
    });

    return worker;
}

worker = createWorker();

const mediaCodecs = [
    {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
            "x-google-start-bitrate": 1000,
        }
    }
]

peers.on("connection", async (socket) => {
    console.log(socket.id);
    socket.emit("connection-success", {socketId: socket.id});

    socket.on("disconnect", () => {
        // do some clean up
        console.log("peer disconnected");
    });

    router = await worker.createRouter({mediaCodecs});

    socket.on("getRPTCapabilities", (callback) => {
        const rtpCapabilities = router.rtpCapabilities;
        console.log("rtp Capabilities", rtpCapabilities);

        callback({rtpCapabilities});
    });

    socket.on("createWebRtcTransport", async ({sender}, callback) => {
        console.log(`Is this a sender request? ${sender}`);
        if (sender) {
            producerTransport = await createWebRtcTransport(callback);
        } else {
            consumerTransport = await createWebRtcTransport(callback);
        }
    });

    socket.on("transport-connect", async ({dtlsParameters}) => {
        console.log("DTLS PARAMS...", {dtlsParameters});
        await producerTransport.connect({dtlsParameters})

    });

    socket.on("transport-produce", async ({kind, rtpParameters, appData}, callback) => {
        producer = await producerTransport.produce({kind, rtpParameters});

        console.log("producer ID: ", producer.id, producer.kind);

        producer.on("transportclose", () => {
            console.log("transport for this producer closed");
            producer.close();
        })

        callback({id: producer.id});
    });

    socket.on("transport-recv-connect", async ({dtlsParameters}) => {
        console.log(`DTLS PARAMS: ${dtlsParameters}`);
        await consumerTransport.connect({dtlsParameters});
    });

    socket.on("consume", async ({rtpCapabilities}, callback) => {
        try {
            if (router.canConsume({
                producerId: producer.id,
                rtpCapabilities,
            })) {
                consumer = await consumerTransport.consume({
                    producerId: producer.id,
                    rtpCapabilities,
                    paused: true,
                });

                consumer.on("transportclose", () => {
                    console.log("transport close from consumer")
                });

                consumer.on("producerclose", () => {
                    console.log("producer of consumer closed")
                });

                const params = {
                    id: consumer.id,
                    producerId: producer.id,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                }

                callback({params});
            }

        } catch (error) {
            console.log(error.message);
            callback({
                params: {error}
            });
        }
    })

    socket.on("consumer-resume", async () => {
        // await consumer.resume();
        await consumer.resume()
        console.log("consumer resume");
    });
});


const createWebRtcTransport = async (callback) => {
    try {
        const webRtcTransport_options = {
            listenIps: [
                {
                    ip: "172.25.128.1", // Default Switch ip configuration on localhost machine
                    announcedIp: "172.25.128.1" // ip address of local machine
                }
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        };
        let transport = await router.createWebRtcTransport(webRtcTransport_options);

        console.log(`transport id: ${transport.id}`);

        transport.on("dtlsstatechange", dtlsState => {
            if (dtlsState === "closed") {
                transport.close();
            }
        });

        transport.on("close", () => {
            console.log("transport closed");
        });

        callback({
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,

            }
        });
        return transport;

    } catch (error) {
        console.log(error);
        callback({params: {error: error}});
    }
}
