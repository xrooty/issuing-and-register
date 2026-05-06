import { useState } from "react";

export default function AuthView({ session, loading, authError, onSignIn, onSignOut }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <section className="view is-active">
      <article className="panel" style={{ maxWidth: 520, margin: "32px auto" }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Authentication</p>
            <h3>{session ? "Authenticated Session" : "Login Required"}</h3>
          </div>
        </div>
        {session ? (
          <div className="form-grid">
            <p>Signed in as <strong>{session.user?.email || "Unknown user"}</strong></p>
            <button className="button button-secondary" type="button" onClick={onSignOut}>Sign out</button>
          </div>
        ) : (
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              onSignIn({ email, password });
            }}
          >
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {authError ? <p style={{ color: "#ef4444", margin: 0 }}>{authError}</p> : null}
            <button className="button button-primary" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}
      </article>
    </section>
  );
}
