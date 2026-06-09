# luminicall-backend 
## Spring Boot Websockets backend for a webRTC client
##
#### Technologies:

- Netty-SocketIO

<hr>

### Instructions

#### write your local ip for each step

1) **Generate certificates:**
    - Use a Unix-like terminal (bash, git bash, etc)
    - write your local ip address of your computer/host like `192.168.0.3`
    - if you're on linux: 
       ```bash
          ip -br addr show | grep 192.168
       ```
    - if you're on windows: 
      ```bash
         ipconfig | findstr "192.168"
      ```

<hr>

2) **generate your keys**
   - execute the following command:
      ```bash
      mkdir ssl && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ssl/private_key.pem -out ssl/certificate.pem -subj "/C=Ar/ST=Buenos Aires/L=Tigre/O=Organization/OU=Departament/CN=<YOUR_IP>"
      ```

<hr>

3) **build docker image**
   1. **with docker compose**
   ```bash
   docker compose up -d --build
   ``` 
   
   2. **only docker if you already have configured a proxy**
   
   ```bash
   docker build -t your-image-name:latest && docker run -d --name your-container your-image-name
   ``` 
##
##
