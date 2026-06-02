# Spring Boot WebRTC Peer-to-Peer Video Communication Room Based

#### Technologies:

- WebRTC
- Socket.IO
- BootStrap


WebRTC (Web Real-Time Communication): An open-source project that provides real-time communication between web browsers and mobile applications. Mostly used for video, audio communications, screen sharing, and streaming.

SocketIO: A JavaScript library designed for real-time, bidirectional communication. In this project, I have implemented "netty-socket.io" ( Java Spring Boot compatible) as a signaling mechanism.


### Instructions


#### write your local ip for each step

1) **Generate certificates:**
    - Usá una terminal estilo Unix (bash, git bash, etc)
    - write your local ip address of your computer/host like `192.168.0.3`
    - please create an empty ssl folder under the project directory


`mkdir ssl && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ssl/private_key.pem -out ssl/certificate.pem -subj "/C=Ar/ST=Buenos Aires/L=Tigre/O=Organizacion/OU=Departamento/CN=<TU_IP>"`

2) **update nginx.conf**

change `<YOUR_LOCAL_IP>` with your local ip same as step 1

3) **build docker image**

`docker-compose up -d --build`
