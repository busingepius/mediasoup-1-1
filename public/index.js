// import {io} from "/socket.io-client.js"
// import * as mediasoup from "mediasoup-client.js";

const io = require("socket.io-client");
const mediasoup = require("mediasoup-client");

const btnGetLocalVideo = document.querySelector("#getLocalVideo");
const btnGetRPTCapabilities = document.querySelector("#getRPTCapabilities");
const btnCreateDevice = document.querySelector("#createDevice");
const btnCreateSendTransport = document.querySelector("#createSendTransport");
const btnConnectSendTransportProduce = document.querySelector("#connectSendTransportProduce");
const btnCreateRecevTransport = document.querySelector("#createRecevTransport");
const btnConnectRecevTransportConsume = document.querySelector("#connectRecevTransportConsume");
let localVideo = document.querySelector("#localVideo");
let remoteVideo = document.querySelector("#remoteVideo");

const socket = io("/mediasoup");

socket.on("connection-success", ({socketId}) => {
    console.log(socketId);
});

let device;
let rtpCapabilities;
let producerTransport;
let consumerTransport
let producer;
let consumer;

let params = {
    // mediasoup params
    encoding: [
        {
            rid: "r0",
            maxBitrate: 100000,
            scalabilityMode: "S1T3",
        },
        {
            rid: "r1",
            maxBitrate: 300000,
            scalabilityMode: "S1T3",
        },
        {
            rid: "r2",
            maxBitrate: 900000,
            scalabilityMode: "S1T3",
        },
    ],
    codecOptions: {
        videoGoogleStartBitrate: 1000
    }
}


const streamSuccess = async (stream) => {

    localVideo.srcObject = stream;
    const track = await stream.getVideoTracks()[0];

    params = {track, ...params}
}

const getLocalStream = async () => {
    try {
        let mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    width: {min: 640, max: 720},
                    height: {min: 400, max: 720}
                }
            }
        )
        await streamSuccess(mediaStream);
    } catch (error) {
        console.log(error.message);
    }
}

//CREATE DEVICE
const createDevice = async () => {
    try {
        device = new mediasoup.Device();
        await device.load({
            // get rtpCapabilities of a device
            routerRtpCapabilities: rtpCapabilities,
        });

        console.log("RTP Capabilities", rtpCapabilities);
    } catch (e) {
        console.log(e)
        if (e.name === "UnsupportedError") {
            console.warn("browser not supported")
        }
    }
}

const getRPTCapabilities = () => {
    socket.emit("getRPTCapabilities", (data) => {
        console.log(`Router RTP Capabilities...${data.rtpCapabilities}`);

        rtpCapabilities = data.rtpCapabilities;
    });
}

const createSendTransport = () => {
    socket.emit("createWebRtcTransport", {sender: true}, ({params}) => {
        if (params.error) {
            console.log(params.error);
            return;
        }

        console.log(params);

        producerTransport = device.createSendTransport(params);

        producerTransport.on("connect", async ({dtlsParameters}, callback, errback) => {
            try {
                // signal local DTLS parameters to the server side transport
                await socket.emit("transport-connect", {
                    // transportId: producerTransport.id,
                    dtlsParameters: dtlsParameters,

                });
                // Tell the transport that parameters were transported
                callback();
            } catch (error) {
                errback(error);
            }
        });

        producerTransport.on("produce", async (parameters, callback, errback) => {
            console.log(parameters);

            try {
                await socket.emit("transport-produce", {
                    // transportId: producerTransport.id,
                    kind: parameters.kind,
                    rtpParameters: parameters.rtpParameters,
                    appData: parameters.appData,
                }, ({id}) => {
                    // tell the transport that parameters were transmitted and produced
                    // server side producer's id
                    callback({id});
                });
            } catch (e) {
                errback(e);
            }
        })
    });
}
const connectSendTransportProduce = async () => {
    producer = await producerTransport.produce(params);
    producer.on("trackended", () => {
        console.log("track ended");

        // close video track
    });
    producer.on("transportclose", () => {
        console.log("transport ended");

        // close video track
    });
}

const createRecevTransport = async () => {
    await socket.emit("createWebRtcTransport", {sender: false}, ({params}) => {
        if (params.error) {
            console.log(params.error);
            return;
        }

        console.log(params);

        // create recv transport
        consumerTransport = device.createRecvTransport(params);

        consumerTransport.on("connect",async({dtlsParameters},callback,errback)=>{
            try{
                // signal local DTLS parameters to the server side transport

                await socket.emit("transport-recv-connect",{
                    // transportId:consumerTransport.id,
                    dtlsParameters,
                });

                // tell the transport that the parameters were transmitted back to the server
                callback();
            }catch (e) {
                // tell the transport that something was wrong
                errback(e);
            }
        })
    });
}

const connectRecevTransportConsume = async()=>{
    await socket.emit("consume",{
        rtpCapabilities:device.rtpCapabilities,
    },async ({params})=>{
        if(params.error){
            console.log("cannot consume");
            return;
        }

        console.log(params);
        consumer = await consumerTransport.consume({
            id:params.id,
            producerId:params.producerId,
            kind:params.kind,
            rtpParameters:params.rtpParameters,
        });

        const {track} = consumer;
        remoteVideo.srcObject = new MediaStream([track]);//original

        socket.emit("consumer-resume");
    });
}

btnGetLocalVideo.addEventListener("click", getLocalStream);
btnGetRPTCapabilities.addEventListener("click", getRPTCapabilities);
btnCreateDevice.addEventListener("click", createDevice);
btnCreateSendTransport.addEventListener("click", createSendTransport);
btnConnectSendTransportProduce.addEventListener("click", connectSendTransportProduce);
btnCreateRecevTransport.addEventListener("click", createRecevTransport);
btnConnectRecevTransportConsume.addEventListener("click", connectRecevTransportConsume);

