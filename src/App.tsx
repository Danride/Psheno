import { useCallback, useState } from "react";
import Menu from "./components/Menu";
import GameScreen from "./components/GameScreen";
import { loadSave, storeSave, type SaveData } from "./game/skins";
import { audio } from "./game/audio";
import type { GameResult } from "./game/engine";

export default function App() {
  const [save, setSave] = useState<SaveData>(() => {
    const s = loadSave();
    audio.muted = s.muted;
    return s;
  });
  const [screen, setScreen] = useState<"menu" | "game">("menu");

  const update = useCallback((patch: Partial<SaveData>) => {
    setSave((prev) => {
      const next = { ...prev, ...patch };
      storeSave(next);
      return next;
    });
  }, []);

  const onResult = useCallback((r: GameResult) => {
    setSave((prev) => {
      const next = { ...prev, coins: prev.coins + r.coinsEarned, best: Math.max(prev.best, r.score) };
      storeSave(next);
      return next;
    });
  }, []);

  const onToggleMute = useCallback(() => {
    setSave((prev) => {
      const next = { ...prev, muted: !prev.muted };
      audio.muted = next.muted;
      storeSave(next);
      return next;
    });
  }, []);

  return (
    <div className="h-full w-full">
      {screen === "menu" ? (
        <Menu
          save={save}
          onStart={() => {
            audio.ensure();
            audio.click();
            setScreen("game");
          }}
          onPurchase={(id, cost) => update({ coins: save.coins - cost, owned: [...save.owned, id], selected: id })}
          onSelect={(id) => update({ selected: id })}
        />
      ) : (
        <GameScreen
          skinId={save.selected}
          best={save.best}
          muted={save.muted}
          onToggleMute={onToggleMute}
          onResult={onResult}
          onExit={() => setScreen("menu")}
        />
      )}
    </div>
  );
}
