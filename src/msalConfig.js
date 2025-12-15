import { PublicClientApplication } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: "730e97cf-c60c-41d8-8e63-a85fedceb917", // From Azure
    authority: "https://login.microsoftonline.com/cb01a1bc-f3ff-4e2a-9040-62700612484e",
    redirectUri: "http://localhost:3001",
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);
