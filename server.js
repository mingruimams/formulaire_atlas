const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration Grist (à remplir dans votre .env)
const GRIST_API_ENDPOINT = 'https://grist.numerique.gouv.fr/api';
const GRIST_API_KEY = process.env.GRIST_API_KEY;
const GRIST_DOC_ID = process.env.GRIST_DOC_ID;
const GRIST_TABLE_NAME = process.env.GRIST_TABLE_NAME; // Nom de votre table dans Grist

// Endpoint pour recevoir les données du formulaire de points remarquables
app.post("/api/points", async (req, res) => {
    const { Nom, Prenom, Mail, Point, Lat, Long } = req.body;

    // Validation des champs requis
    if (!Nom || !Prenom || !Mail || !Point || !Lat || !Long) {
        return res.status(400).json({
            error: "Tous les champs sont requis: Nom, Prenom, Mail, Point, Latitude et Longitude"
        });
    }

    try {
        // Envoi des données à Grist
        const response = await axios.post(
            `${GRIST_API_ENDPOINT}/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE_NAME}/records`,
            {
                records: [{
                    fields: {
                        Nom,
                        Prenom,
                        Mail,
                        Point,
                        Lat: parseFloat(Lat),  // Conversion en nombre
                        Long: parseFloat(Long) // Conversion en nombre
                    }
                }],
            },
            {
                headers: {
                    Authorization: `Bearer ${GRIST_API_KEY}`,
                    "Content-Type": "application/json",
                }
            }
        );

        console.log("Données envoyées à Grist:", {
            Nom, Prenom, Mail, Point, Lat, Long
        });

        res.status(201).json({
            success: true,
            message: "Point remarquable enregistré avec succès",
            data: response.data
        });
    } catch (error) {
        console.error("Erreur Grist:", error.response?.data || error.message);

        // Gestion spécifique des erreurs Grist
        if (error.response) {
            return res.status(error.response.status).json({
                error: "Échec de l'envoi à Grist",
                details: error.response.data
            });
        }

        res.status(500).json({
            error: "Erreur serveur",
            details: error.message
        });
    }
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Endpoint disponible: POST http://localhost:${PORT}/api/points`);
});