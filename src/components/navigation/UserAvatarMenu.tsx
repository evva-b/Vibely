"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { clearAccessToken } from "@/features/auth/lib/auth-token";
import { api } from "@/lib/api";
import styles from "./UserAvatarMenu.module.css";

const avatarChangeEvent = "vibely:avatar-changed";

function readAvatar(userId: string) {
  try {
    const avatar = window.localStorage.getItem(`vibely:user-avatar:${userId}`);
    return avatar && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar)
      ? avatar
      : null;
  } catch {
    return null;
  }
}

export function notifyAvatarChanged() {
  window.dispatchEvent(new Event(avatarChangeEvent));
}

export default function UserAvatarMenu() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      void api.currentUser()
        .then((currentUser) => {
          if (active) setUser({ id: currentUser.id, name: currentUser.name });
        })
        .catch((error: unknown) => {
          if (active) {
            setLoadError(
              error instanceof Error ? error.message : "Не удалось загрузить пользователя.",
            );
          }
        });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const updateAvatar = () => setAvatar(readAvatar(user.id));
    queueMicrotask(updateAvatar);
    window.addEventListener(avatarChangeEvent, updateAvatar);
    window.addEventListener("storage", updateAvatar);
    return () => {
      window.removeEventListener(avatarChangeEvent, updateAvatar);
      window.removeEventListener("storage", updateAvatar);
    };
  }, [user]);

  function signOut() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <details className={styles.accountMenu}>
      <summary
        aria-label={user ? `Меню пользователя ${user.name}` : "Меню профиля"}
        title={loadError || undefined}
      >
        {avatar
          ? <Image alt="" height={34} src={avatar} unoptimized width={34} />
          : <UserRound aria-hidden="true" />}
      </summary>
      <div className={styles.accountDropdown}>
        <Link href="/profile"><UserRound aria-hidden="true" />Профиль компании</Link>
        <button onClick={signOut} type="button"><LogOut aria-hidden="true" />Выйти</button>
      </div>
    </details>
  );
}
