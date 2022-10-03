# video-decryption-streaming-stack

Sample Docker container stack to stream encrypted Twilio Video Compositions

## Pre-requisites

1. Generate a Public and Private Keys.
2. Enable encryption of the Twilio Video Compositions via Twilio Console. You can follow the steps mentioned on Twilio Docs for [Encrypting your Stored Media](https://www.twilio.com/docs/video/tutorials/encrypting-your-stored-media).
3. Create data directory at the root of the project and then created a decrypted directory under the data directory.
    ```sh
    mkdir data
    cd data
    mkdir decrypted
    ```
4. Create a keys directory at the root of the project
    ```sh
    mkdir keys
    ```
5. Copy the private key of the Public-Private Key pair used to encrypt the video compositions in Twilio Console.
