/*
 * Live smoke test for Firebase Storage rules.
 * Creates short-lived admin/news and user/profile files through the public
 * Storage REST API, verifies denial cases, then removes test objects via Admin.
 */
const fs = require("fs");
const admin = require("firebase-admin");

const config = require("../src/config");

const API_KEY = "AIzaSyAiCNqKzdquePYCB3FiHA4lO45I5AUdbIk";
const BUCKET = "energy-monitoring-system-f182d.firebasestorage.app";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync(config.firebase.credentialPath, "utf8"))
  ),
  databaseURL: config.firebase.databaseURL,
  storageBucket: BUCKET,
});

async function idTokenFor(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload.idToken;
}

async function uploadAs(uid, objectPath) {
  const token = await idTokenFor(uid);
  const response = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
      BUCKET
    )}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "image/png",
      },
      body: PNG,
    }
  );
  const body = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    error: response.ok ? "" : body.slice(0, 300),
  };
}

async function main() {
  const adminsSnap = await admin.database().ref("admins").get();
  const adminIds = Object.entries(adminsSnap.val() || {})
    .filter(([, enabled]) => enabled === true)
    .map(([uid]) => uid);
  if (!adminIds.length) throw new Error("No RTDB admin account found.");

  const listed = await admin.auth().listUsers(1000);
  const nonAdmin = listed.users.find((user) => !adminIds.includes(user.uid));
  if (!nonAdmin) throw new Error("No non-admin account available for denial test.");

  const stamp = Date.now();
  const newsPath = `content/news/rules_test/${stamp}.png`;
  const deniedNewsPath = `content/news/rules_test/${stamp}_denied.png`;
  const profilePath = `users/${nonAdmin.uid}/profile/${stamp}.png`;
  const otherProfilePath = `users/${adminIds[0]}/profile/${stamp}_denied.png`;

  try {
    const adminNews = await uploadAs(adminIds[0], newsPath);
    const userNews = await uploadAs(nonAdmin.uid, deniedNewsPath);
    const ownProfile = await uploadAs(nonAdmin.uid, profilePath);
    const otherProfile = await uploadAs(nonAdmin.uid, otherProfilePath);

    const report = {
      adminNewsUploadAllowed: adminNews.ok,
      nonAdminNewsUploadDenied: userNews.status === 403,
      ownProfileUploadAllowed: ownProfile.ok,
      otherUsersProfileUploadDenied: otherProfile.status === 403,
      statuses: {
        adminNews: adminNews.status,
        nonAdminNews: userNews.status,
        ownProfile: ownProfile.status,
        otherProfile: otherProfile.status,
      },
      errors: {
        adminNews: adminNews.error,
        ownProfile: ownProfile.error,
      },
    };
    console.log(JSON.stringify(report, null, 2));
    if (!Object.values(report).slice(0, 4).every(Boolean)) process.exitCode = 2;
  } finally {
    const bucket = admin.storage().bucket();
    await Promise.all(
      [newsPath, deniedNewsPath, profilePath, otherProfilePath].map((path) =>
        bucket.file(path).delete({ ignoreNotFound: true })
      )
    );
    await admin.app().delete();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
