import { Header, Footer } from "@/components/chrome";
import { LoginForm } from "@/components/auth-controls";
export default function Login() {
  return (
    <>
      <Header />
      <main className="card login">
        <div className="eyebrow">BUSINESS & PLATFORM ACCESS</div>
        <h1>Welcome back.</h1>
        <p>Manage your locations, branding and review allowance.</p>
        <LoginForm />
        <div className="notice">
          Local accounts are created by the seed command. Find their randomly
          generated credentials in <code>local-access.txt</code>. Public
          registration is disabled.
        </div>
      </main>
      <Footer />
    </>
  );
}
