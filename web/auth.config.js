// Edge-safe deel van de NextAuth-config — geen providers met Node-only deps
// (bcryptjs, node:crypto) hierin, want middleware.js draait in de Edge Runtime.
export default {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
};
