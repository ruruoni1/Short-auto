import React from "react";
import {createRoot} from "react-dom/client";
import {ChannelPackRegistry} from "@nihon-zupzup/core";
import {nihonZupZupChannelPack} from "@nihon-zupzup/channel-pack";
import "./styles.css";

const registry = new ChannelPackRegistry();
registry.register(nihonZupZupChannelPack.registration());
const pack = nihonZupZupChannelPack.registration().pack;

const App = () => (
  <main>
    <p className="eyebrow">{pack.displayName}</p>
    <h1>Studio Core 준비 완료</h1>
    <p>Channel Pack {pack.id} · Content Profiles {registry.listProfiles(pack.id).length}개</p>
  </main>
);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element.");
createRoot(rootElement).render(<App />);
