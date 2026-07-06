// EDGE RUNTIME — restricciones:
// - Sin createAdminClient() (service_role key no debe estar en edge)
// - Sin agenticLogger completo (usa APIs de Node)
// - Sin imports de node:* (fs, crypto completo, etc.)
// - Para lógica compleja: usar un Route Handler y Next.redirect()
