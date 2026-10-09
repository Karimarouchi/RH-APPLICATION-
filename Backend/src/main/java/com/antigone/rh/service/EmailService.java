package com.antigone.rh.service;

import com.antigone.rh.entity.Referentiel;
import com.antigone.rh.enums.TypeReferentiel;
import com.antigone.rh.repository.ReferentielRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Properties;

/**
 * Envoi d'emails par SMTP (Gmail, Hostinger, OVH, Office 365, etc.).
 * Les parametres peuvent etre modifies par l'admin dans Referentiels > Parametres systeme
 * (MAIL_SMTP_HOST, MAIL_SMTP_PORT, MAIL_SMTP_USERNAME, MAIL_SMTP_PASSWORD, MAIL_SMTP_SECURITY,
 * MAIL_FROM, MAIL_FROM_NAME). Une valeur vide utilise la valeur du .env.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class EmailService {

  private final ReferentielRepository referentielRepository;

  @Value("${app.mail.host:}")
  private String defaultHost;

  @Value("${app.mail.port:587}")
  private String defaultPort;

  @Value("${app.mail.username:}")
  private String defaultUsername;

  @Value("${app.mail.password:}")
  private String defaultPassword;

  @Value("${app.mail.security:}")
  private String defaultSecurity;

  @Value("${app.mail.from:}")
  private String defaultFrom;

  @Value("${app.mail.from-name:Antigone RH}")
  private String defaultFromName;

  @Value("${app.mail.enabled:true}")
  private boolean mailEnabled;

  public void sendCredentials(String toEmail, String employeNom, String username, String password) {
    String subject = "Antigone RH - Vos identifiants de connexion";
    String htmlBody = buildCredentialsHtml(employeNom, username, password);
    sendEmail(toEmail, subject, htmlBody, employeNom);
  }

  public void sendPasswordReset(String toEmail, String employeNom, String resetLink) {
    String subject = "Antigone RH - Réinitialisation de votre mot de passe";
    String htmlBody = buildResetPasswordHtml(employeNom, resetLink);
    sendEmail(toEmail, subject, htmlBody, employeNom);
  }

  /** Parametre systeme saisi par l'admin, sinon valeur par defaut (.env). */
  private String setting(String libelle, String fallback) {
    try {
      return referentielRepository
          .findByTypeReferentielAndActifTrue(TypeReferentiel.PARAMETRE_SYSTEME)
          .stream()
          .filter(r -> libelle.equalsIgnoreCase(r.getLibelle()))
          .map(Referentiel::getValeur)
          .filter(v -> v != null && !v.isBlank())
          .findFirst()
          .map(String::trim)
          .orElse(fallback == null ? "" : fallback.trim());
    } catch (Exception e) {
      return fallback == null ? "" : fallback.trim();
    }
  }

  private void sendEmail(String toEmail, String subject, String htmlBody, String recipientName) {
    String host = setting("MAIL_SMTP_HOST", defaultHost);

    if (!mailEnabled || host.isBlank()) {
      log.info("=== EMAIL (mode simulation : aucun serveur SMTP configure) ===");
      log.info("À: {}", toEmail);
      log.info("Sujet: {}", subject);
      log.info("Corps HTML généré pour: {}", recipientName);
      log.info("=== FIN EMAIL ===");
      return;
    }

    try {
      int port = Integer.parseInt(setting("MAIL_SMTP_PORT", defaultPort));
      String username = setting("MAIL_SMTP_USERNAME", defaultUsername);
      String password = setting("MAIL_SMTP_PASSWORD", defaultPassword);
      String from = setting("MAIL_FROM", defaultFrom.isBlank() ? username : defaultFrom);
      String fromName = setting("MAIL_FROM_NAME", defaultFromName);
      String security = setting("MAIL_SMTP_SECURITY", defaultSecurity).toUpperCase();
      if (security.isBlank()) {
        security = port == 465 ? "SSL" : (port == 25 ? "NONE" : "STARTTLS");
      }

      JavaMailSenderImpl sender = new JavaMailSenderImpl();
      sender.setHost(host);
      sender.setPort(port);
      sender.setDefaultEncoding(StandardCharsets.UTF_8.name());
      if (!username.isBlank()) {
        sender.setUsername(username);
        sender.setPassword(password);
      }

      Properties props = sender.getJavaMailProperties();
      props.put("mail.smtp.auth", String.valueOf(!username.isBlank()));
      props.put("mail.smtp.connectiontimeout", "10000");
      props.put("mail.smtp.timeout", "15000");
      props.put("mail.smtp.writetimeout", "15000");
      switch (security) {
        case "SSL" -> props.put("mail.smtp.ssl.enable", "true");
        case "STARTTLS" -> {
          props.put("mail.smtp.starttls.enable", "true");
          props.put("mail.smtp.starttls.required", "true");
        }
        default -> { /* NONE */ }
      }
      props.put("mail.smtp.ssl.trust", host);

      MimeMessage message = sender.createMimeMessage();
      MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
      helper.setFrom(from, fromName);
      helper.setTo(toEmail);
      helper.setSubject(subject);
      helper.setText(htmlBody, true);
      sender.send(message);

      log.info("Email envoyé à {} - {} (SMTP {}:{} {})", toEmail, subject, host, port, security);
    } catch (Exception e) {
      log.error("Erreur lors de l'envoi de l'email à {}: {}", toEmail, e.getMessage());
    }
  }

  private String buildCredentialsHtml(String employeNom, String username, String password) {
    return """
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Antigone RH - Vos identifiants de connexion</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding:40px 0;">
            <tr>
              <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%%; background-color:#ffffff; border:1px solid #e2e8f0; border-radius:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                  
                  <!-- HEADER -->
                  <tr>
                    <td style="background-color:#683b77; background:linear-gradient(135deg, #683b77 0%%, #8a4f9e 100%%); border-radius:15px 15px 0 0; padding:40px 40px; text-align:center;">
                      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <div style="width:56px; height:56px; background-color:rgba(255,255,255,0.15); border-radius:14px; display:inline-block; line-height:56px; margin-bottom:16px; text-align:center;">
                              <span style="font-size:28px; color:#ffffff; vertical-align:middle; line-height:56px;">&#128188;</span>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td align="center">
                            <h1 style="margin:0; font-size:26px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">Antigone RH</h1>
                            <p style="margin:6px 0 0; font-size:14px; color:#f3e8ff; font-weight:500;">Gestion des Ressources Humaines</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- BODY -->
                  <tr>
                    <td style="padding:40px 40px 30px; background-color:#ffffff;">
                      <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#0f172a;">
                        Bonjour %s 👋
                      </h2>
                      <p style="margin:0 0 24px; font-size:15px; color:#475569; line-height:1.6;">
                        Votre compte a été créé avec succès sur la plateforme <strong style="color:#683b77;">Antigone RH</strong>. Vous trouverez ci-dessous vos identifiants pour vous connecter.
                      </p>

                      <!-- Credentials Card -->
                      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#faf8fc; border:1px solid #f3ebf7; border-radius:12px; overflow:hidden;">
                        <tr>
                          <td style="padding:20px 24px 16px;">
                            <p style="margin:0 0 6px; font-size:12px; font-weight:700; color:#683b77; text-transform:uppercase; letter-spacing:1px;">Nom d'utilisateur</p>
                            <p style="margin:0; font-size:18px; font-weight:700; color:#0f172a; font-family:'Courier New',Courier,monospace; letter-spacing:0.5px;">%s</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 24px;">
                            <div style="height:1px; background-color:#f0e6f5;"></div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:16px 24px 20px;">
                            <p style="margin:0 0 6px; font-size:12px; font-weight:700; color:#683b77; text-transform:uppercase; letter-spacing:1px;">Mot de passe provisoire</p>
                            <p style="margin:0; font-size:18px; font-weight:700; color:#0f172a; font-family:'Courier New',Courier,monospace; letter-spacing:0.5px;">%s</p>
                          </td>
                        </tr>
                      </table>

                      <!-- Warning -->
                      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                        <tr>
                          <td style="background-color:#fffbeb; border-left:4px solid #f59e0b; border-radius:4px; padding:14px 18px;">
                            <p style="margin:0; font-size:13px; color:#b45309; line-height:1.5; font-weight:500;">
                              &#9888;&#65039; <strong>Important :</strong> Pour des raisons de sécurité, veuillez modifier votre mot de passe dès votre première connexion.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- FOOTER -->
                  <tr>
                    <td style="background-color:#f8fafc; border-top:1px solid #f1f5f9; border-radius:0 0 15px 15px; padding:32px 40px; text-align:center;">
                      <p style="margin:0 0 8px; font-size:12px; color:#64748b; line-height:1.5;">
                        Cet email a été envoyé automatiquement par la plateforme
                      </p>
                      <p style="margin:0 0 16px; font-size:14px; font-weight:700; color:#683b77;">
                        Antigone RH
                      </p>
                      <div style="height:1px; background-color:#e2e8f0; margin:0 40px 16px;"></div>
                      <p style="margin:0; font-size:11px; color:#94a3b8;">
                        &copy; 2026 Antigone RH. Tous droits réservés.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """
        .formatted(employeNom, username, password);
  }

  private String buildResetPasswordHtml(String employeNom, String resetLink) {
    return """
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Antigone RH - Réinitialisation du mot de passe</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding:40px 0;">
            <tr>
              <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%%; background-color:#ffffff; border:1px solid #e2e8f0; border-radius:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                  
                  <!-- HEADER -->
                  <tr>
                    <td style="background-color:#683b77; background:linear-gradient(135deg, #683b77 0%%, #8a4f9e 100%%); border-radius:15px 15px 0 0; padding:40px 40px; text-align:center;">
                      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <div style="width:56px; height:56px; background-color:rgba(255,255,255,0.15); border-radius:14px; display:inline-block; line-height:56px; margin-bottom:16px; text-align:center;">
                              <span style="font-size:28px; color:#ffffff; vertical-align:middle; line-height:56px;">&#128274;</span>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td align="center">
                            <h1 style="margin:0; font-size:26px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">Antigone RH</h1>
                            <p style="margin:6px 0 0; font-size:14px; color:#f3e8ff; font-weight:500;">Réinitialisation du mot de passe</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- BODY -->
                  <tr>
                    <td style="padding:40px 40px 30px; background-color:#ffffff;">
                      <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#0f172a;">
                        Bonjour %s 👋
                      </h2>
                      <p style="margin:0 0 24px; font-size:15px; color:#475569; line-height:1.6;">
                        Vous avez demandé la réinitialisation de votre mot de passe sur la plateforme <strong style="color:#683b77;">Antigone RH</strong>. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
                      </p>

                      <!-- CTA Button -->
                      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                        <tr>
                          <td align="center">
                            <a href="%s" style="display:inline-block; padding:14px 36px; background-color:#683b77; background:linear-gradient(135deg, #683b77 0%%, #8a4f9e 100%%); color:#ffffff !important; font-size:15px; font-weight:700; text-decoration:none; border-radius:10px; box-shadow:0 4px 12px rgba(104,59,119,0.3); border:1px solid #683b77;">
                              Réinitialiser mon mot de passe
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Warning -->
                      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                        <tr>
                          <td style="background-color:#fffbeb; border-left:4px solid #f59e0b; border-radius:4px; padding:14px 18px;">
                            <p style="margin:0; font-size:13px; color:#b45309; line-height:1.5; font-weight:500;">
                              &#9888;&#65039; Ce lien est valable pendant <strong>30 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.
                            </p>
                          </td>
                        </tr>
                      </table>

                      <!-- Fallback link -->
                      <p style="margin:28px 0 0; font-size:12px; color:#94a3b8; line-height:1.6;">
                        Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br/>
                        <a href="%s" style="color:#683b77; text-decoration:underline; word-break:break-all;">%s</a>
                      </p>
                    </td>
                  </tr>

                  <!-- FOOTER -->
                  <tr>
                    <td style="background-color:#f8fafc; border-top:1px solid #f1f5f9; border-radius:0 0 15px 15px; padding:32px 40px; text-align:center;">
                      <p style="margin:0 0 8px; font-size:12px; color:#64748b; line-height:1.5;">
                        Cet email a été envoyé automatiquement par la plateforme
                      </p>
                      <p style="margin:0 0 16px; font-size:14px; font-weight:700; color:#683b77;">
                        Antigone RH
                      </p>
                      <div style="height:1px; background-color:#e2e8f0; margin:0 40px 16px;"></div>
                      <p style="margin:0; font-size:11px; color:#94a3b8;">
                        &copy; 2026 Antigone RH. Tous droits réservés.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """
        .formatted(employeNom, resetLink, resetLink, resetLink);
  }
}
