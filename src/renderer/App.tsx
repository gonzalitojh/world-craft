import { messages } from './messages/es';

/** Pantalla inicial mínima del scaffold. */
export function App() {
  const { appInfo } = window.worldCraft;

  return (
    <main className="wc-scaffold">
      <h1 className="wc-scaffold__title">{messages.scaffold.heading}</h1>
      <p className="wc-scaffold__lead">{messages.scaffold.description}</p>
      <p className="wc-scaffold__version">
        {messages.scaffold.version(appInfo.version)}
      </p>
    </main>
  );
}
