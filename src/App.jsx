
import { useState, useEffect } from "react";
import axios from "axios";
import {
  Container,
  Typography,
  Button,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  MenuItem,
  Modal,
  Paper,
  Grid,
  IconButton,
  Divider,
  Avatar,
} from "@mui/material";
import { ExpandMore, Edit } from "@mui/icons-material";
import { PublicClientApplication } from "@azure/msal-browser";

// ================= MSAL CONFIG =================
const msalConfig = {
  auth: {
    clientId: "730e97cf-c60c-41d8-8e63-a85fedceb917",
    authority:
      "https://login.microsoftonline.com/cb01a1bc-f3ff-4e2a-9040-62700612484e",
    redirectUri: window.location.origin,
  },
};
const msalInstance = new PublicClientApplication(msalConfig);
async function withTokenRetry(graphCall) {
  try {
    return await graphCall();
  } catch (err) {
    // Only retry if unauthorized
    if (err.status === 401 || err.message?.includes("InvalidAuthenticationToken")) {
      console.warn("Token expired → acquiring new token...");
      try {
        const newToken = await msalInstance.acquireTokenSilent({
          scopes: ["Mail.Send", "Mail.ReadWrite", "User.Read"],
          account: msalInstance.getAllAccounts()[0],
        });
        setAccessToken(newToken.accessToken);
        return await graphCall(); // retry once
      } catch (renewErr) {
        alert("Session expired. Please sign in again.");
        return null;
      }
    }
    throw err;
  }
}
function Calendar({ deployments = [], otherDeployments = [] }) {
  const [month, setMonth] = useState(new Date());

  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const todayStr = new Date().toISOString().split("T")[0];

  // Build lookup maps
  const todaySet = new Set(deployments.map(d => d.date));
  const otherMap = new Map(
    otherDeployments.map(d => [d.date, d])
  );

  const days = [];
  for (let i = 1; i <= end.getDate(); i++) {
    const dateStr = `${month.getFullYear()}-${String(
      month.getMonth() + 1
    ).padStart(2, "0")}-${String(i).padStart(2, "0")}`;

    let dotColor = null;

    if (todaySet.has(dateStr)) {
      dotColor = "#1976d2"; // blue (today deployments)
    } else if (otherMap.has(dateStr)) {
      if (dateStr < todayStr) dotColor = "#2e7d32"; // green (past)
      else if (dateStr > todayStr) dotColor = "#d32f2f"; // red (future)
    }

    days.push(
      <Box
        key={i}
        sx={{
          width: "14.28%",
          textAlign: "center",
          py: 0.8,
          position: "relative",
          fontSize: "0.85rem",
          color: "#333"
        }}
      >
        {i}
        {dotColor && (
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: dotColor,
              position: "absolute",
              bottom: 4,
              left: "50%",
              transform: "translateX(-50%)"
            }}
          />
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
      >
        <Button
          size="small"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          ‹
        </Button>

        <Typography fontWeight={600}>
          {month.toLocaleString("default", { month: "long" })}{" "}
          {month.getFullYear()}
        </Typography>

        <Button
          size="small"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          ›
        </Button>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap" }}>{days}</Box>

      {/* Legend */}
      <Box mt={1} display="flex" gap={2} justifyContent="center">
        <LegendDot color="#1976d2" label="Today" />
        <LegendDot color="#2e7d32" label="Past" />
        <LegendDot color="#d32f2f" label="Upcoming" />
      </Box>
    </Box>
  );
}

function LegendDot({ color, label }) {
  return (
    <Box display="flex" alignItems="center" gap={0.5}>
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: color
        }}
      />
      <Typography variant="caption">{label}</Typography>
    </Box>
  );
}
function formatMessageHtml(message) {
  if (!message) return "";

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const uncRegex = /(\\\\[^\s]+)/gi;

  let formatted = message;

  // HTTP / HTTPS links
  formatted = formatted.replace(urlRegex, (url) => {
    return `
      <div style="margin-top:8px;">
        <a href="${url}" target="_blank" style="
          display:inline-block;
          padding:8px 14px;
          background:#EEF2FF;
          color:#3730A3;
          border-radius:8px;
          text-decoration:none;
          font-weight:600;
          font-size:13px;
        ">
          🔗 ${url}
        </a>
      </div>
    `;
  });

  // UNC / Network paths
  formatted = formatted.replace(uncRegex, (path) => {
    const fileHref = `file://${path.replace(/\\/g, "/")}`;

    return `
      <div style="
        margin-top:10px;
        padding:10px 14px;
        background:#F1F5F9;
        border-radius:10px;
        font-size:13px;
        line-height:1.6;
      ">
        <div style="font-weight:600; color:#0F172A; margin-bottom:4px;">
          📁 Network Path
        </div>

        <div style="
          font-family:Consolas, monospace;
          background:#FFFFFF;
          padding:6px 10px;
          border-radius:6px;
          border:1px dashed #CBD5E1;
          color:#334155;
          word-break:break-all;
        ">
          ${path}
        </div>

        <div style="margin-top:6px; font-size:12px; color:#64748B;">
          👉 Copy & paste this path into File Explorer
        </div>

        <a href="${fileHref}" style="
          display:inline-block;
          margin-top:6px;
          font-size:12px;
          color:#2563EB;
          text-decoration:underline;
        ">
          Try opening (may be blocked by Outlook)
        </a>
      </div>
    `;
  });

  return `
    <div style="
      background:#F8FAFC;
      border-radius:12px;
      padding:14px 16px;
      margin-top:10px;
      color:#334155;
      font-size:13.5px;
      line-height:1.6;
    ">
      ${formatted}
    </div>
  `;
}



function getStatusBadgeHtml(status) {
  const styles = {
    Completed: {
      bg: "#E6F4EA",
      color: "#1E7F43",
      label: "Completed",
      icon: "✅",
    },
    Pending: {
      bg: "#FFF6E5",
      color: "#B26A00",
      label: "Pending",
      icon: "⏳",
    },
    "Not Required": {
      bg: "#FFF0E8",
      color: "#C05621",
      label: "Not Required",
      icon: "➖",
    },
  };

  const s = styles[status] || styles.Pending;

  return `
    <span style="
      background:${s.bg};
      color:${s.color};
      padding:6px 12px;
      border-radius:999px;
      font-weight:600;
      font-size:13px;
      display:inline-block;
    ">
      ${s.icon} ${s.label}
    </span>
  `;
}


export default function App() {
  const [deployments, setDeployments] = useState([]);
  const [otherDeployments, setOtherDeployments] = useState([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [banks, setBanks] = useState([]);
  const [newBank, setNewBank] = useState("");
  const [newDate, setNewDate] = useState("");
  const [editIndex, setEditIndex] = useState(null);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [editingStep, setEditingStep] = useState(null);
const [editingField, setEditingField] = useState(null); 
const handleLocalStepChange = (depId, stepName, field, value) => {
  setDeployments(prev =>
    prev.map(dep =>
      dep.id === depId
        ? {
            ...dep,
            steps: dep.steps.map(s =>
              s.name === stepName
                ? { ...s, [field]: value }
                : s
            ),
          }
        : dep
    )
  );
};
const clearToAddBank=()=>{
  setEditIndex(null);
  setNewBank("");
  setNewDate("");
}
  // ================= INIT MSAL =================
  useEffect(() => {
    const initMSAL = async () => {
      try {
        if (msalInstance.initialize) await msalInstance.initialize();
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          setUser(accounts[0].username);
          const tokenResp = await msalInstance.acquireTokenSilent({
            scopes: ["Mail.Send", "Mail.ReadWrite", "User.Read"],
            account: accounts[0],
          });
          setAccessToken(tokenResp.accessToken);
        }
      } catch (err) {
        console.error("MSAL init error:", err);
      }
    };
    initMSAL();
  }, []);

  const signIn = async () => {
    try {
      if (msalInstance.initialize) await msalInstance.initialize();
      const loginResp = await msalInstance.loginPopup({
        scopes: ["Mail.Send", "Mail.ReadWrite", "User.Read"],
      });
      setUser(loginResp.account.username);
      const tokenResp = await msalInstance.acquireTokenSilent({
        scopes: ["Mail.Send", "Mail.ReadWrite", "User.Read"],
        account: loginResp.account,
      });
      setAccessToken(tokenResp.accessToken);
    } catch (err) {
      console.error("Sign-in error:", err);
      alert("Sign-in failed.");
    }
  };

  const signOut = async () => {
    try {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        await msalInstance.logoutPopup({ account: accounts[0] });
      }
      setUser(null);
      setAccessToken(null);
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  };

  // ================= FETCH DATA =================
const fetchData = async () => {
  try {
    const res = await axios.get("https://deploymentapi.onrender.com/api/deployments");
    const fresh = res.data;

    setDeployments(prev =>
      fresh.map(f => {
        const existing = prev.find(p => p.id === f.id);

        if (!existing) return f; // new bank

        const mergedSteps = f.steps.map(newStep => {
          const oldStep = existing.steps.find(s => s.name === newStep.name);

          if (!oldStep) return newStep;

          const messageField = `${existing.id}-${newStep.name}-message`;
          const statusField = `${existing.id}-${newStep.name}-status`;

          const isEditingMsg = editingField === messageField;
          const isEditingStatus = editingField === statusField;

          return {
            ...newStep,

            // DO NOT OVERWRITE MESSAGE if user typed anything not yet submitted
            message: isEditingMsg ? oldStep.message : 
                     oldStep.message !== newStep.message && oldStep.disabled !== true
                       ? oldStep.message  // keep local edits
                       : newStep.message, // use backend only after submit

            // DO NOT OVERWRITE STATUS if user edited locally
            status: isEditingStatus ? oldStep.status : 
                    oldStep.status !== newStep.status && oldStep.disabled !== true
                      ? oldStep.status
                      : newStep.status,
          };
        });

        return { ...f, steps: mergedSteps };
      })
    );
  } catch (err) {
    console.error("Error fetching deployments:", err);
  }
};




  const fetchOtherDeployments = async () => {
    try {
      const res = await axios.get("https://deploymentapi.onrender.com/api/all-deployments");
      setOtherDeployments(res.data);
    } catch (err) {
      console.error("Error fetching other deployments:", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchOtherDeployments();
    const interval = setInterval(() => {
      fetchData();
      fetchOtherDeployments();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchBanks = async () => {
    const res = await axios.get("https://deploymentapi.onrender.com/api/deployments");
    setBanks(res.data);
  };

  const isBankCompleted = (dep) => dep.steps.every((s) => s.status === "Completed");

  // ================= MAIL HELPERS =================
  // Utility to call graph with Authorization header
  function graphFetch(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    return fetch(url, { ...options, headers });
  }

  // Find message by exact subject (first attempt). Returns id or null.
  async function findMessageIdByExactSubject(subject) {
    try {
      // Use exact match filter
      const filter = `subject eq '${subject.replace(/'/g, "''")}'`;
      const url = `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(
        filter
      )}&$top=1`;
      const res = await graphFetch(url, { method: "GET" });
      if (res.ok) {
        const json = await res.json();
        if (json && json.value && json.value.length > 0) return json.value[0].id;
      } else {
        // Not fatal — will fallback later
        const txt = await res.text();
        console.warn("Exact subject search failed:", txt);
      }
    } catch (err) {
      console.warn("findMessageIdByExactSubject error:", err);
    }
    return null;
  }

  // Try startswith + search fallback (returns id or null)
  async function findMessageIdByPrefixOrSearch(prefix) {
    try {
      const filter = `startswith(subject,'${prefix.replace(/'/g, "''")}')`;
      const url = `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(
        filter
      )}&$top=1`;
      const res = await graphFetch(url, { method: "GET" });
      if (res.ok) {
        const json = await res.json();
        if (json && json.value && json.value.length > 0) return json.value[0].id;
      } else {
        const txt = await res.text();
        console.warn("Prefix filter failed, will fallback to search. response:", txt);
      }
    } catch (err) {
      console.warn("findMessageIdByPrefixOrSearch error:", err);
    }

    // Fallback: Graph search
    try {
      const searchQuery = `"${prefix}"`;
      const url2 = `https://graph.microsoft.com/v1.0/me/messages?$search=${encodeURIComponent(
        searchQuery
      )}&$top=1`;
      const res2 = await graphFetch(url2, { method: "GET" });
      if (res2.ok) {
        const json2 = await res2.json();
        if (json2 && json2.value && json2.value.length > 0) return json2.value[0].id;
      } else {
        const txt = await res2.text();
        console.warn("Search fallback failed:", txt);
      }
    } catch (err) {
      console.warn("findMessageIdByPrefixOrSearch fallback error:", err);
    }

    return null;
  }

  // Send initial mail (no draft). Add unique timestamp to subject (ISO) and poll mailbox to find that exact subject.
  async function sendInitialMail(bank, date, bodyHtml) {
    // Unique timestamp identifier
    const timestamp = new Date().toISOString();
    const subjectFull = `[Deployment] ${bank} - ${date} - ${timestamp}`;

    const mailPayload = {
      message: {
        subject: subjectFull,
        body: { contentType: "HTML", content: bodyHtml },
        toRecipients: [{ emailAddress: { address: "DeploymentTracker@fi-tek.co.in" } }],
      },
      saveToSentItems: true,
    };

    // 1) Send mail
    const sendRes = await graphFetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      body: JSON.stringify(mailPayload),
      headers: { "Content-Type": "application/json" },
    });

    if (!sendRes.ok) {
      const txt = await sendRes.text();
      throw new Error("sendMail failed: " + txt);
    }

    // 2) Poll mailbox for the exact subject to get real message id
    const maxAttempts = 8;
    let attempt = 0;
    const baseDelay = 700; // ms
    while (attempt < maxAttempts) {
      // short wait before searching on first attempt (some indexing delay)
      await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1)));
      try {
        const foundId = await findMessageIdByExactSubject(subjectFull);
        if (foundId) {
          return foundId;
        }
        // fallback to prefix search (in case exact eq fails due to small normalization differences)
        const foundPrefix = await findMessageIdByPrefixOrSearch(`[Deployment] ${bank} - ${date} -`);
        debugger;
        if (foundPrefix) {
          return foundPrefix;
        }
      } catch (err) {
        console.warn("Polling search attempt error:", err);
      }
      attempt++;
    }

    // If we exit loop, we failed to find message id
    throw new Error(
      "Unable to locate sent message in mailbox after sending. It may be delayed or filtered. Subject: " +
        subjectFull
    );
  }

  // Create a reply (createReply -> patch -> send)
// NEW sendReply that ensures reply goes to correct thread + adds group in CC
async function sendReply(originalMessageId, commentHtml) {
  // 1) Create draft reply
  const createUrl = `https://graph.microsoft.com/v1.0/me/messages/${originalMessageId}/createReply`;
  const createRes = await graphFetch(createUrl, { method: "POST" });

  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error("createReply failed: " + txt);
  }

  const draft = await createRes.json();
  const replyId = draft.id;

  // 2) Modify the reply → add CC + set body
  const patchUrl = `https://graph.microsoft.com/v1.0/me/messages/${replyId}`;
  const patchRes = await graphFetch(patchUrl, {
    method: "PATCH",
    body: JSON.stringify({
      body: {
        contentType: "HTML",
        content: commentHtml,
      },
      ccRecipients: [
        {
          emailAddress: {
            address: "DeploymentTracker@fi-tek.co.in"
          }
        }
      ]
    }),
  });

  if (!patchRes.ok) {
    const txt = await patchRes.text();
    throw new Error("Patch failed: " + txt);
  }

  // 3) Send the reply
  const sendUrl = `https://graph.microsoft.com/v1.0/me/messages/${replyId}/send`;
  const sendRes = await graphFetch(sendUrl, { method: "POST" });

  if (!sendRes.ok) {
    const txt = await sendRes.text();
    throw new Error("send failed: " + txt);
  }

  return true;
}



  // Auto-create messages for today's deployments that lack messageId:
  useEffect(() => {
    if (!accessToken || !user) return;
    if (!deployments || deployments.length === 0) return;

    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const toProcess = deployments.filter((d) => d.date === today && !d.messageId);

      if (!toProcess.length) return;

      for (const dep of toProcess) {
        try {
          // subject prefix we search by (without timestamp) so we can detect older initial mail too
          const subjectPrefix = `[Deployment] ${dep.bank} - ${dep.date}`;

          // 1) try find existing message in mailbox (prefix)
          const foundId = await findMessageIdByPrefixOrSearch(subjectPrefix);
          if (foundId) {
            // save found id
            await axios.post("https://deploymentapi.onrender.com/api/save-message-id", {
              deploymentId: dep.id,
              messageId: foundId,
            });
            console.log("Found existing message for", dep.bank, foundId);
            continue;
          }

          // 2) not found → send an initial mail (unique timestamp in subject), poll and save returned messageId
          const initComment = `
<div style="
  font-family:Segoe UI, Arial, sans-serif;
  background:#F8FAFC;
  border-radius:14px;
  padding:16px 18px;
  color:#334155;
">

  <div style="
    display:inline-block;
    background:#E0F2FE;
    color:#075985;
    padding:8px 14px;
    border-radius:999px;
    font-weight:600;
    font-size:13px;
    margin-bottom:10px;
  ">
    🧵 Deployment Thread Started
  </div>

  <p style="margin:10px 0 6px 0;">
    <b>${dep.bank}</b> — deployment scheduled for <b>${dep.date}</b>
  </p>

  <p style="
    font-size:13px;
    color:#64748B;
    margin:0;
  ">
    Initiated by <b>${user}</b><br/>
    <i>${ new Date().toLocaleString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}</i>
  </p>

</div>
`;
          const newMessageId = await sendInitialMail(dep.bank, dep.date, initComment);

          await axios.post("https://deploymentapi.onrender.com/api/save-message-id", {
            deploymentId: dep.id,
            messageId: newMessageId,
          });

          console.log("Created initial message for", dep.bank, newMessageId);
        } catch (err) {
          console.error("Auto-create thread error for", dep.bank, err);
        }
      }

      // refresh local data once done
      await fetchData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user, deployments]);

  // ================= STEP UPDATE =================
const handleUpdateStepSubmit = async (depId, stepName) => {
  if (!user) return alert("Please sign in first.");
setEditingField(null);
  const dep = deployments.find(d => d.id === depId);
  const step = dep.steps.find(s => s.name === stepName);

  try {
    // 1) Update backend
    await axios.post("https://deploymentapi.onrender.com/api/update-step", {
      bank: dep.bank,
      stepName: step.name,
      status: step.status,
      message: step.message,
      updatedBy: user,
    });

    // 2) Refresh deployments (important)
    await fetchData();

    // 3) Prepare reply HTML
const commentHtml = `
<div style="
  font-family:Segoe UI, Arial, sans-serif;
  font-size:14px;
  background:#F5F7FB;
  padding:16px;
  border-radius:14px;
  color:#1F2937;
">

  <!-- Step Title -->
  <h3 style="
    margin:0 0 6px 0;
    font-size:16px;
    font-weight:700;
    color:#111827;
  ">
    ${step.name}
  </h3>

  <!-- Bank subtle label -->
  <p style="
    margin:0 0 12px 0;
    font-size:13px;
    color:#6B7280;
  ">
    ${dep.bank}
  </p>

  <!-- Status -->
  <p style="margin:0 0 12px 0;">
    ${getStatusBadgeHtml(step.status)}
  </p>

  <!-- Message -->
  ${step.message ? formatMessageHtml(step.message) : ""}

  <hr style="
    border:none;
    border-top:1px solid #E5E7EB;
    margin:16px 0;
  " />

  <!-- Footer -->
  <p style="
    font-size:12.5px;
    color:#6B7280;
    margin:0;
  ">
    Updated by <b style="color:#374151;">${user}</b><br/>
    <i>${ new Date().toLocaleString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}</i>
  </p>

</div>
`;



    let messageId = dep.messageId;

    // 4) Find messageId if missing
    if (!messageId) {
      const prefix = `[Deployment] ${dep.bank} - ${dep.date}`;
      const found = await withTokenRetry(() =>
        findMessageIdByPrefixOrSearch(prefix)
      );
      if (found) messageId = found;
    }

    // 5) Reply or send initial mail
    if (messageId) {
      await withTokenRetry(() => sendReply(messageId, commentHtml));
    } else {
      const newId = await withTokenRetry(() =>
        sendInitialMail(dep.bank, dep.date, commentHtml)
      );
      await axios.post("https://deploymentapi.onrender.com/api/save-message-id", {
        deploymentId: dep.id,
        messageId: newId,
      });
    }

    // 6) Disable the updated step locally
    setDeployments(prev =>
      prev.map(d =>
        d.id === dep.id
          ? {
              ...d,
              steps: d.steps.map(s =>
                s.name === step.name
                  ? { ...s, disabled: true, updatedBy: user }
                  : s
              ),
            }
          : d
      )
    );

    // 7) **STEP-4: disable all steps if this bank is fully completed**
    const updatedDep = deployments.find(d => d.id === depId);
    debugger;
if (updatedDep.steps.every(s => s.status === "Completed" || s.status === "Not Required")) {

      setDeployments(prev =>
        prev.map(d =>
          d.id === dep.id
            ? {
                ...d,
                bank: d.bank.includes("✅ Completed")
  ? d.bank
  : `${d.bank} ✅ Completed`,
                steps: d.steps.map(s => ({ ...s, disabled: true }))
              }
            : d
        )
      );
debugger;
      // OPTIONAL: send closing reply
      if (dep.messageId) {
        await sendReply(
          dep.messageId,
         `
<div style="
  font-family:Segoe UI, Arial, sans-serif;
  background:#F8FAFC;
  padding:18px;
  border-radius:14px;
  border:1px solid #E6F4EA;
">

  <!-- Completion Badge -->
  <div style="
    background:#E6F4EA;
    color:#1E7F43;
    padding:10px 14px;
    border-radius:10px;
    font-weight:600;
    display:inline-block;
    margin-bottom:10px;
  ">
    ✅ Deployment Completed
  </div>

  <!-- Thread Closed Badge -->
  <div style="
    background:#EDF2FF;
    color:#3F51B5;
    padding:8px 12px;
    border-radius:10px;
    font-weight:600;
    display:inline-block;
    margin-left:8px;
  ">
    📩 Mail Thread Closed
  </div>

  <!-- Summary -->
  <p style="
    margin-top:14px;
    font-size:14px;
    color:#334155;
  ">
    <b>${dep.bank}</b> deployment has been successfully completed and no further
    updates are expected on this thread.
  </p>

</div>
`

        );
      }
    }

    // stop editing
    setEditingStep(null);

  } catch (err) {
    console.error(err);
    alert("Update or mail failed.");
  }
};



  // ================= SETUP SAVE =================
  const handleSetupSave = async () => {
    if (!newBank || !newDate) return alert("Enter bank & date");

    const payload =
      editIndex !== null
        ? { bank: newBank, date: newDate, editId: banks[editIndex].id }
        : { bank: newBank, date: newDate };

    await axios.post("https://deploymentapi.onrender.com/api/create-master", payload);
    setNewBank("");
    setNewDate("");
    setEditIndex(null);
    fetchBanks();
    fetchData();
    fetchOtherDeployments();
  };

  const handleEditBank = (index) => {
    setEditIndex(index);
    setNewBank(banks[index].bank);
    setNewDate(banks[index].date);
    setSetupOpen(true);
  };

  // ================= UI RENDER =================
  return (
    <Container maxWidth={false} sx={{ py: 4, px: 2 }}>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Today's Deployments
        </Typography>

        <Box display="flex" gap={2} alignItems="center">
          {!user ? (
            <Button variant="contained" color="primary" onClick={signIn}>
              Sign In
            </Button>
          ) : (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2,
                py: 1,
                background: "linear-gradient(90deg,#dfe9f3,#ffffff)",
                borderRadius: "9999px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: "#1976d2", fontSize: 14 }}>
                {user ? user.charAt(0).toUpperCase() : ""}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "#0d47a1" }}>
                  {user}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Signed in
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                color="error"
                sx={{ borderRadius: "20px", textTransform: "none", fontWeight: 600 }}
                onClick={signOut}
              >
                Sign Out
              </Button>
            </Box>
          )}

          <Button
            variant="contained"
            sx={{ ml: 1 }}
            onClick={() => {
              setSetupOpen(true);
              fetchBanks();
              fetchOtherDeployments();
            }}
          >
            Setup
          </Button>
        </Box>
      </Box>

      {/* ================= DEPLOYMENTS LIST ================= */}
      <Box display="flex" gap={2} alignItems="flex-start">
  
  {/* LEFT — Deployments take most width */}
  <Box flex={1} minWidth={0}>
      {deployments.map((dep) => (
        <Accordion key={dep.id} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography fontWeight="bold">
              {dep.bank} {isBankCompleted(dep) && "✅ Completed"}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {dep.steps.map((step, idx) => (
                <Grid item xs={12} key={idx}>
                  <Paper sx={{ p: 2 }}>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                      <Typography sx={{ width: 220 }}>{step.name}</Typography>

                      <TextField
                        select
                        value={step.status}
                        size="small"
                        disabled={step.disabled}
                       onChange={(e) => {
    setEditingField(`${dep.id}-${step.name}-status`);
    handleLocalStepChange(dep.id, step.name, "status", e.target.value);
}}

onFocus={() => setEditingStep(`${dep.id}-${step.name}`)}
onBlur={() => setEditingField(null)}

                        sx={{ minWidth: 160 }}
                      >
                        <MenuItem value="Pending">Pending</MenuItem>
                        <MenuItem value="Completed">Completed</MenuItem>
                        <MenuItem value="Not Required">Not Required</MenuItem>
                      </TextField>

                      {!step.disabled && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleUpdateStepSubmit(dep.id, step.name)}
                        >
                          Submit
                        </Button>
                      )}
                    </Box>

                    <TextField
                      placeholder="Message or link..."
                      fullWidth
                      onFocus={() => setEditingStep(`${dep.id}-${step.name}`)}
onBlur={() => setEditingField(null)}

                      size="small"
                      value={step.message || ""}
                      disabled={step.disabled}
                      onChange={(e) => {
    setEditingField(`${dep.id}-${step.name}-message`);
    handleLocalStepChange(dep.id, step.name, "message", e.target.value);
}}

                    />

                    {step.disabled && (
                      <Typography variant="caption">Updated by: {step.updatedBy}</Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
</Box>

  {/* RIGHT — Calendar column */}
  <Box
    sx={{
      width: 300,
      position: "sticky",
      top: 24,
      flexShrink: 0,
    }}
  >

 <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
      <Calendar deployments={deployments} otherDeployments={otherDeployments} />
    </Paper>
  </Box>

</Box>
      {/* ================= SETUP MODAL ================= */}
      <Modal open={setupOpen} onClose={() => setSetupOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 760,
            maxHeight: "80vh",
            overflow: "hidden",
            bgcolor: "background.paper",
            boxShadow: 24,
            p: 3,
            borderRadius: 2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography variant="h6" mb={2}>
            {editIndex !== null ? "Edit Deployment" : "Add Deployment"}
          </Typography>
<Typography><Button onClick={()=>clearToAddBank()}>Clear</Button></Typography>
          <Box display="flex" gap={2} mb={2}>
            <TextField label="Bank Name" value={newBank} onChange={(e) => setNewBank(e.target.value)} fullWidth />
            <TextField
              label="Date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              sx={{ width: 220 }}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="contained" onClick={handleSetupSave}>
              {editIndex !== null ? "Update" : "Add"}
            </Button>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Box display="flex" gap={2} flex="1" overflow="hidden">
            <Box flex="1" overflow="auto" pr={1}>
              <Typography fontWeight="bold" mb={1}>
                Today's Deployments
              </Typography>
              {deployments.map((b, i) => (
                <Box
                  key={b.id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mt={1}
                  p={1}
                  border={1}
                  borderColor="grey.300"
                  borderRadius={1}
                >
                  <Typography variant="body2">
                    {b.bank} ({b.date})
                  </Typography>
                  <IconButton size="small" onClick={() => handleEditBank(i)}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>

            <Box flex="1" overflow="auto" pl={1}>
              <Typography fontWeight="bold" mb={1}>
                Other Deployments
              </Typography>
              {otherDeployments.map((b, i) => (
                <Box
                  key={b.id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mt={1}
                  p={1}
                  border={1}
                  borderColor="grey.300"
                  borderRadius={1}
                >
                  <Typography variant="body2">
                    {b.bank} ({b.date})
                  </Typography>
                  <IconButton size="small" onClick={() => handleEditBank(i)}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Modal>
    </Container>
  );
}
