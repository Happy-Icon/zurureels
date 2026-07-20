import { MainLayout } from "@/components/layout/MainLayout";

export default function Privacy() {
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: June 20, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to ZuruSasa ("we", "our", or "us"). We are committed to protecting your personal
              information and your right to privacy. This Privacy Policy explains how we collect, use,
              and share information about you when you use our platform at{" "}
              <a href="https://zurusasa.com" className="underline text-primary">zurusasa.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We collect information you provide directly to us, including:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
              <li>Name, email address, and phone number when you create an account</li>
              <li>Profile information such as date of birth and profile photo</li>
              <li>Content you post, such as reels, event listings, and messages</li>
              <li>Payment information when you make or receive bookings</li>
              <li>Communications with us (e.g. support requests)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              When you sign in with a third-party service (e.g. Google, Facebook), we receive basic
              profile information such as your name and email address as permitted by your privacy
              settings on that platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
              <li>To create and manage your account</li>
              <li>To facilitate bookings, events, and transactions</li>
              <li>To send you verification codes and important notifications</li>
              <li>To personalise your experience on the platform</li>
              <li>To improve our services and develop new features</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Sharing Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal data. We may share your information with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2 mt-3">
              <li>Other users as needed to facilitate bookings (e.g. host sees guest name)</li>
              <li>Service providers who help us operate the platform (e.g. Supabase, Cloudinary)</li>
              <li>Law enforcement or government bodies if required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal data for as long as your account is active or as needed to
              provide services. You may request deletion of your account and data at any time by
              contacting us at{" "}
              <a href="mailto:support@zurusasa.com" className="underline text-primary">
                support@zurusasa.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Deletion</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you signed in using Facebook, you can request deletion of the data we received
              from Facebook by emailing{" "}
              <a href="mailto:support@zurusasa.com" className="underline text-primary">
                support@zurusasa.com
              </a>{" "}
              with the subject line "Facebook Data Deletion Request". We will process your request
              within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar tracking technologies to maintain your session and improve
              your experience. You can control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Depending on your location, you may have the right to access, correct, or delete your
              personal data. To exercise these rights, contact us at{" "}
              <a href="mailto:support@zurusasa.com" className="underline text-primary">
                support@zurusasa.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any
              significant changes by posting a notice on the platform or sending you an email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <div className="mt-3 text-muted-foreground space-y-1">
              <p>📧 <a href="mailto:support@zurusasa.com" className="underline text-primary">support@zurusasa.com</a></p>
              <p>🌐 <a href="https://zurusasa.com" className="underline text-primary">https://zurusasa.com</a></p>
            </div>
          </section>

        </div>
      </div>
    </MainLayout>
  );
}
