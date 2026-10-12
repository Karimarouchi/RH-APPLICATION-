package com.antigone.rh.service;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.InputStreamContent;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.Permission;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Async;

import java.io.FileInputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

@Service
@Slf4j
public class GoogleDriveService {

    @Value("${app.google.drive.service-account-key-path:service-account.json}")
    private String serviceAccountKeyPath;

    @Value("${app.google.drive.parent-folder-id:}")
    private String parentFolderId;

    private static final String APPLICATION_NAME = "Antigone RH";
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final List<String> SCOPES = Collections.singletonList(DriveScopes.DRIVE);

    private Drive driveService;

    @PostConstruct
    public void init() {
        try {
            reinit();
            log.info("Google Drive Service initialized with Service Account (status: {})",
                    driveService != null ? "Ready" : "Failed");
        } catch (IOException e) {
            log.error("Failed to initialize Google Drive Service: {}", e.getMessage());
        }
    }

    private static final String[] MOIS_FR = {"Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"};

    /** Dossier du mois, dans la structure du client : [parent] / [Client] / [Annee] / [Mois]. */
    private String getOrCreateMonthFolderId(String clientName, LocalDate date) throws IOException {
        String safeClientName = clientName.replaceAll("[\\/:*?\"<>|]", "_").trim();
        String clientFolderId = getOrCreateFolder(safeClientName, parentFolderId);
        String yearFolderId = getOrCreateFolder(String.valueOf(date.getYear()), clientFolderId);
        return getOrCreateFolder(MOIS_FR[date.getMonthValue() - 1], yearFolderId);
    }

    private String webViewLinkOf(String folderId) throws IOException {
        return driveService.files().get(folderId).setFields("id, webViewLink").execute().getWebViewLink();
    }

    /**
     * Dossier Media Plan du mois : [parent] / [Client] / [Annee] / [Mois] / Mediaplan
     * (meme structure que generateFullClientStructure : reutilise les dossiers existants, ne cree que le manquant).
     * Returns the webViewLink of the Mediaplan folder.
     */
    public String getOrCreateClientMonthFolder(String clientName, LocalDate date) throws IOException {
        ensureInitialized();
        String monthFolderId = getOrCreateMonthFolderId(clientName, date);
        String link = webViewLinkOf(getOrCreateFolder("Mediaplan", monthFolderId));
        log.info("Drive path resolved. Mediaplan folder link: {}", link);
        return link;
    }

    /**
     * Dossier d'une tache selon son type, dans la structure existante du client :
     *   Post          -> [Client] / [Annee] / [Mois] / Posts
     *   Video         -> [Client] / [Annee] / [Mois] / Video
     *   Documentation -> [Client] / [Annee] / Documentation
     * Aucun dossier "Mois Annee" parallele n'est cree. Returns the webViewLink.
     */
    public String getOrCreateTacheTypeFolder(String clientName, LocalDate date, String type) throws IOException {
        ensureInitialized();
        String t = type == null ? "" : type.trim();
        String folderId;
        if (t.equalsIgnoreCase("Documentation")) {
            String safeClientName = clientName.replaceAll("[\\/:*?\"<>|]", "_").trim();
            String clientFolderId = getOrCreateFolder(safeClientName, parentFolderId);
            String yearFolderId = getOrCreateFolder(String.valueOf(date.getYear()), clientFolderId);
            folderId = getOrCreateFolder("Documentation", yearFolderId);
        } else {
            String monthFolderId = getOrCreateMonthFolderId(clientName, date);
            String name = t.equalsIgnoreCase("Post") || t.equalsIgnoreCase("Posts") ? "Posts"
                    : t.equalsIgnoreCase("Video") || t.equalsIgnoreCase("Vidéo") ? "Video" : t;
            folderId = getOrCreateFolder(name, monthFolderId);
        }
        String link = webViewLinkOf(folderId);
        log.info("Tâche Drive path resolved ({}). Folder link: {}", t, link);
        return link;
    }

    /** Extrait l'identifiant d'un dossier depuis son lien webViewLink (.../folders/{id}?...). */
    public static String folderIdFromLink(String link) {
        if (link == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("/folders/([A-Za-z0-9_-]+)").matcher(link);
        return m.find() ? m.group(1) : null;
    }

    /**
     * Envoie un fichier directement dans un dossier Drive (flux, resumable par morceaux de 8 Mo).
     * Rien n'est conserve sur le serveur ni en base de donnees.
     */
    public File uploadFile(String folderId, String fileName, String mimeType, java.io.InputStream in, long size)
            throws IOException {
        ensureInitialized();
        File meta = new File();
        meta.setName(fileName);
        meta.setParents(Collections.singletonList(folderId));
        InputStreamContent content = new InputStreamContent(mimeType, in);
        content.setLength(size);
        Drive.Files.Create req = driveService.files().create(meta, content)
                .setFields("id, name, mimeType, size, webViewLink, thumbnailLink, createdTime");
        req.getMediaHttpUploader().setDirectUploadEnabled(false).setChunkSize(8 * 1024 * 1024);
        File created = req.execute();
        log.info("Livrable '{}' envoye dans le dossier Drive {}", fileName, folderId);
        return created;
    }

    /** Liste les fichiers (hors sous-dossiers) d'un dossier Drive, du plus recent au plus ancien. */
    public List<File> listFiles(String folderId) throws IOException {
        ensureInitialized();
        return driveService.files().list()
                .setQ("'" + folderId + "' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'")
                .setOrderBy("createdTime desc")
                .setPageSize(100)
                .setFields("files(id, name, mimeType, size, webViewLink, thumbnailLink, createdTime)")
                .execute().getFiles();
    }

    /**
     * Looks up (WITHOUT creating) the Drive link for an existing MediaPlan folder.
     * Traverses the hierarchy created by generateFullClientStructure:
     *   [parent] / [ClientName] / [Year] / [MonthName] / Mediaplan
     *
     * Returns the webViewLink if the full path exists, or null if any folder is missing.
     */
    public String getExistingMediaPlanFolderLink(String clientName, LocalDate date) {
        try {
            ensureInitialized();

            String safeClientName = clientName.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
            String yearStr = String.valueOf(date.getYear());
            String[] frenchMonths = {"Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"};
            String monthName = frenchMonths[date.getMonthValue() - 1];

            log.info("Looking up Drive path: [root:{}] / [{}] / [{}] / [{}] / Mediaplan",
                    parentFolderId, safeClientName, yearStr, monthName);

            // Step 1: Find client folder
            String clientFolderId = findFolder(safeClientName, parentFolderId);
            if (clientFolderId == null) {
                log.warn("Drive: Client folder '{}' not found — no link assigned.", safeClientName);
                return null;
            }

            // Step 2: Find year folder inside client
            String yearFolderId = findFolder(yearStr, clientFolderId);
            if (yearFolderId == null) {
                log.warn("Drive: Year folder '{}' not found under client '{}'.", yearStr, safeClientName);
                return null;
            }

            // Step 3: Find month folder inside year
            String monthFolderId = findFolder(monthName, yearFolderId);
            if (monthFolderId == null) {
                log.warn("Drive: Month folder '{}' not found under year '{}'.", monthName, yearStr);
                return null;
            }

            // Step 4: Find Mediaplan folder inside month (created as "Mediaplan" by generateFullClientStructure)
            String mediaPlanFolderId = findFolder("Mediaplan", monthFolderId);
            if (mediaPlanFolderId == null) {
                log.warn("Drive: 'Mediaplan' folder not found under month '{}' / year '{}'.", monthName, yearStr);
                return null;
            }

            // Fetch and return the webViewLink
            File mediaPlanFolder = driveService.files().get(mediaPlanFolderId)
                    .setFields("id, webViewLink")
                    .execute();

            log.info("Drive: Found existing Mediaplan folder link: {}", mediaPlanFolder.getWebViewLink());
            return mediaPlanFolder.getWebViewLink();

        } catch (Exception e) {
            log.error("Drive: Failed to look up Mediaplan folder for client '{}': {}", clientName, e.getMessage());
            return null;
        }
    }


    /**
     * Finds an existing folder by name inside the given parent.
     * Returns the folder ID if found, or null if not found. Does NOT create.
     */
    private String findFolder(String folderName, String parentId) throws IOException {

        String escapedName = folderName.replace("'", "\\'");
        String query = "mimeType='application/vnd.google-apps.folder'"
                + " and name='" + escapedName + "'"
                + " and trashed=false";

        if (parentId != null && !parentId.isEmpty()) {
            query += " and '" + parentId + "' in parents";
        }

        com.google.api.services.drive.model.FileList result = driveService.files().list()
                .setQ(query)
                .setFields("files(id, name)")
                .setPageSize(1)
                .execute();

        if (result.getFiles() != null && !result.getFiles().isEmpty()) {
            String existingId = result.getFiles().get(0).getId();
            log.debug("Found existing folder '{}' (ID: {})", folderName, existingId);
            return existingId;
        }
        return null;
    }

    /**
     * Finds an existing folder by name inside the given parent, or creates it.
     * Returns the folder ID.
     */
    private String getOrCreateFolder(String folderName, String parentId) throws IOException {
        String escapedName = folderName.replace("'", "\\'");
        String query = "mimeType='application/vnd.google-apps.folder'"
                + " and name='" + escapedName + "'"
                + " and trashed=false";

        if (parentId != null && !parentId.isEmpty()) {
            query += " and '" + parentId + "' in parents";
        }

        com.google.api.services.drive.model.FileList result = driveService.files().list()
                .setQ(query)
                .setFields("files(id, name)")
                .setPageSize(1)
                .execute();

        if (result.getFiles() != null && !result.getFiles().isEmpty()) {
            String existingId = result.getFiles().get(0).getId();
            log.info("Found existing folder '{}' (ID: {})", folderName, existingId);
            return existingId;
        }

        // Folder not found — create it
        File fileMetadata = new File();
        fileMetadata.setName(folderName);
        fileMetadata.setMimeType("application/vnd.google-apps.folder");
        if (parentId != null && !parentId.isEmpty()) {
            fileMetadata.setParents(Collections.singletonList(parentId));
        }

        File created = driveService.files().create(fileMetadata)
                .setFields("id")
                .execute();

        log.info("Created new folder '{}' (ID: {})", folderName, created.getId());

        // Make folder public with writer access
        try {
            Permission publicPermission = new Permission()
                    .setType("anyone")
                    .setRole("writer");
            driveService.permissions().create(created.getId(), publicPermission).execute();
            log.info("Folder '{}' set to public and editable.", folderName);
        } catch (Exception pe) {
            log.warn("Could not set public permissions on folder '{}': {}", folderName, pe.getMessage());
        }

        return created.getId();
    }

    
    /**
     * Creates the deep Google Drive folder hierarchy for a client in the background.
     * Hierarchy: ClientName -> Year -> (Documentation, 12 Months -> (Posts, Video, Mediaplan))
     */
    @Async
    public void generateFullClientStructure(String clientName, int year) {
        try {
            ensureInitialized();
            
            String safeClientName = clientName.replaceAll("[\\/:*?\"<>|]", "_").trim();
            log.info("Starting Async generation for Client: {} / Year: {}", safeClientName, year);
            
            // 1. Client Folder
            String clientFolderId = getOrCreateFolder(safeClientName, parentFolderId);
            
            // 2. Year Folder
            String yearFolderId = getOrCreateFolder(String.valueOf(year), clientFolderId);
            
            // 3. Documentation (at year level)
            getOrCreateFolder("Documentation", yearFolderId);
            
            // 4. All 12 Months
            String[] months = {"Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"};
            
            for (String month : months) {
                String monthFolderId = getOrCreateFolder(month, yearFolderId);
                // 5. 3 internal folders
                getOrCreateFolder("Posts", monthFolderId);
                getOrCreateFolder("Video", monthFolderId);
                getOrCreateFolder("Mediaplan", monthFolderId);
            }
            
            log.info("Successfully finished generating 51-folder structure for {} / {}", safeClientName, year);
            
        } catch (Exception e) {
            log.error("Async client folder generation failed for {}: {}", clientName, e.getMessage());
        }
    }

    /**
     * Gets the webViewLink for the root client folder on-demand.
     */
    public String getClientFolderLink(String clientName) {
        try {
            ensureInitialized();
            String safeClientName = clientName.replaceAll("[\\/:*?\"<>|]", "_").trim();
            String escapedName = safeClientName.replace("'", "\\'");
            String query = "mimeType='application/vnd.google-apps.folder' and name='" + escapedName + "' and trashed=false";
            if (parentFolderId != null && !parentFolderId.isEmpty()) {
                query += " and '" + parentFolderId + "' in parents";
            }
            
            com.google.api.services.drive.model.FileList result = driveService.files().list()
                    .setQ(query)
                    .setFields("files(id, webViewLink)")
                    .setPageSize(1)
                    .execute();
                    
            if (result.getFiles() != null && !result.getFiles().isEmpty()) {
                return result.getFiles().get(0).getWebViewLink();
            }
            return null;
        } catch (Exception e) {
            log.error("Failed to fetch client folder link for {}: {}", clientName, e.getMessage());
            return null;
        }
    }

    private void ensureInitialized() throws IOException {
        if (driveService == null) {
            log.info("Drive service is null, attempting re-initialization...");
            reinit();
        }
        if (driveService == null) {
            throw new IOException("Google Drive service is not initialized. Please check service-account.json.");
        }
    }

    public boolean isAuthorized() {
        if (driveService != null)
            return true;
        try {
            reinit();
            return driveService != null;
        } catch (Exception e) {
            return false;
        }
    }

    private void reinit() throws IOException {
        try {
            java.io.File keyFile = new java.io.File(serviceAccountKeyPath);
            log.info("Attempting to load Service Account key from: {}", keyFile.getAbsolutePath());
            if (!keyFile.exists()) {
                log.warn("Service account key file DOES NOT EXIST at: {}", keyFile.getAbsolutePath());
                driveService = null;
                return;
            }

            try (FileInputStream fis = new FileInputStream(keyFile)) {
                GoogleCredentials credentials = ServiceAccountCredentials.fromStream(fis)
                        .createScoped(SCOPES);
                log.info("Service Account credentials loaded successfully (Email: {})",
                        ((ServiceAccountCredentials) credentials).getClientEmail());

                final NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
                driveService = new Drive.Builder(httpTransport, JSON_FACTORY, new HttpCredentialsAdapter(credentials))
                        .setApplicationName(APPLICATION_NAME)
                        .build();

                log.info("Google Drive Service RE-INITIALIZED successfully with Service Account.");
            } catch (Exception e) {
                log.error("CRITICAL: Failed to load Service Account credentials from JSON: {}", e.getMessage(), e);
                driveService = null;
            }
        } catch (Exception e) {
            log.error("Unexpected error during Drive initialization: {}", e.getMessage(), e);
            driveService = null;
        }
    }

    // --- Obsolete OAuth2 methods kept for API compatibility ---

    public String getAuthorizationUrl() throws IOException {
        return null;
    }

    public void exchangeCodeForToken(String code) throws IOException {
        // No-op for service account
    }
}
