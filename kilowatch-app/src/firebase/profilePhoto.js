import { updateProfile } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { auth, database, storage } from "./firebaseConfig";
import { paths } from "./dbPaths";

function guessExtension(uri = "", mimeType = "") {
  const fromMime = String(mimeType || "")
    .split("/")
    .pop()
    ?.replace("jpeg", "jpg");
  if (fromMime && fromMime.length <= 5) return fromMime;

  const match = String(uri).match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match?.[1]?.toLowerCase() || "jpg";
}

async function uriToBlob(uri) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Could not read the selected image.");
  }
  return response.blob();
}

/**
 * Upload a local image URI to Storage and sync photoURL to Auth + RTDB +
 * household member rows the user belongs to.
 */
export async function uploadProfilePhoto({ uri, mimeType } = {}) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Please sign in again.");
  if (!uri) throw new Error("No image selected.");

  const ext = guessExtension(uri, mimeType);
  const path = `users/${user.uid}/profile/${Date.now()}.${ext}`;
  const fileRef = storageRef(storage, path);
  const blob = await uriToBlob(uri);

  await uploadBytes(fileRef, blob, {
    contentType: mimeType || blob.type || "image/jpeg",
  });

  const photoURL = await getDownloadURL(fileRef);
  await syncPhotoURL(photoURL, { previousStoragePath: path });
  return photoURL;
}

export async function removeProfilePhoto() {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Please sign in again.");

  const profileSnap = await get(ref(database, paths.userProfile(user.uid)));
  const profile = profileSnap.val() || {};
  const storagePath = profile.photoStoragePath || null;

  await syncPhotoURL(null);

  if (storagePath) {
    try {
      await deleteObject(storageRef(storage, storagePath));
    } catch (error) {
      console.warn("Profile photo file delete skipped", error);
    }
  }
}

async function syncPhotoURL(photoURL, { previousStoragePath } = {}) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Please sign in again.");

  await updateProfile(user, { photoURL: photoURL || "" });

  const profileUpdates = {
    [`${paths.userProfile(user.uid)}/photoURL`]: photoURL || null,
    [`${paths.userProfile(user.uid)}/photoUpdatedAt`]: Date.now(),
    [`${paths.userProfile(user.uid)}/photoStoragePath`]:
      photoURL && previousStoragePath ? previousStoragePath : null,
    // Own home — owner can always write
    [`${paths.homeMember(user.uid, user.uid)}/photoURL`]: photoURL || null,
  };
  await update(ref(database), profileUpdates);

  // Best-effort: other households the user belongs to
  try {
    const membershipsSnap = await get(
      ref(database, paths.memberships(user.uid))
    );
    const memberships = membershipsSnap.val() || {};
    const otherUpdates = {};
    Object.keys(memberships).forEach((ownerUid) => {
      if (ownerUid === user.uid) return;
      otherUpdates[`${paths.homeMember(ownerUid, user.uid)}/photoURL`] =
        photoURL || null;
    });
    if (Object.keys(otherUpdates).length > 0) {
      await update(ref(database), otherUpdates);
    }
  } catch (error) {
    console.warn("Household photo sync skipped", error);
  }
}
