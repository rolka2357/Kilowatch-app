import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { onValue, ref } from "firebase/database";

import { database } from "../firebase/firebaseConfig";
import { paths } from "../firebase/dbPaths";

/**
 * Active news marked as highlight — for Appliances / Analytics (not the full News tab).
 */
export function normalizeHighlightNews(map) {
  return Object.entries(map || {})
    .map(([id, row]) => ({ id, ...(row || {}) }))
    .filter(
      (row) =>
        row.active !== false &&
        row.highlight === true &&
        String(row.title || "").trim()
    )
    .sort((a, b) => Number(a.order || 99) - Number(b.order || 99));
}

export function openNewsItem(item, navigation) {
  if (item?.link) {
    Linking.openURL(item.link).catch(() => {});
    return;
  }
  navigation?.navigate?.("Tips & News");
}

export default function useHighlightNews() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onValue(
      ref(database, paths.contentNews()),
      (snap) => {
        setNews(normalizeHighlightNews(snap.val()));
        setLoading(false);
      },
      () => {
        setNews([]);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { news, loading };
}
