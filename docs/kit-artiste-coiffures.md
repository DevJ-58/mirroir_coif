# Kit artiste : créer une coiffure pour GARO

Toutes les coiffures GARO sont posées sur **une seule tête** : le mannequin GARO.
Le client voit son propre visage posé sur ce mannequin. Une coiffure modélisée une fois
sur le mannequin tombe donc juste pour tout le monde.

## 1. Récupérer le mannequin

- Fichier : `public/mannequin/garo-mannequin.glb`.
  On le trouve aussi en ligne à `/mannequin/garo-mannequin.glb`, ou par le lien « Télécharger le mannequin GARO » dans la fenêtre de dépôt de la cabine.
- Unités : mètres. La tête mesure environ 0,24 m du menton au sommet du crâne.
- Repère : le haut est en haut, le visage regarde vers l’avant (vue de face « 1 » du pavé numérique dans Blender).
- Objets : `GARO_mannequin_tete`, `GARO_mannequin_oreille_gauche`, `GARO_mannequin_oreille_droite` et `GARO_mannequin_buste`.

## 2. Modéliser dans Blender

1. `Fichier → Importer → glTF 2.0 (.glb)`, puis choisir `garo-mannequin.glb`.
2. **Ne pas déplacer, tourner ni redimensionner le mannequin.** La coiffure doit être posée à sa place exacte.
3. Modéliser la coiffure par-dessus, avec des mèches, des tresses, des locks, un dégradé, etc.
   - Les cheveux doivent recouvrir le crâne. Le visage, lui, reste visible.
   - Pour un dégradé ou un contour à la tondeuse, une coque fine collée au crâne suffit, avec une texture.
4. Matières : *Principled BSDF*, avec une couleur de base ou une texture.
   - La teinte choisie en cabine recolore la coiffure en gardant sa lumière et son grain.
   - Sur « Noir ébène », on voit les couleurs d'origine du fichier.

## 3. Exporter

`Fichier → Exporter → glTF 2.0`, avec ces réglages :

| Réglage | Valeur |
|---|---|
| Format | **glTF Binary (.glb)** |
| Inclure | les objets de la coiffure (le mannequin peut rester : les objets `GARO_mannequin…` sont ignorés) |
| Transformation | +Y vers le haut (réglage par défaut) |
| Géométrie | appliquer les modificateurs, normales activées |
| Compression | **aucune** (pas de Draco) |

À respecter :

- Fichier de **40 Mo au plus**.
- Viser **moins de 200 000 triangles** pour rester fluide sur une tablette.
- Textures en PNG ou JPEG, 2048 px au plus.

## 4. Déposer dans GARO

Dans la cabine d'essayage, cliquer sur **« Déposer une coiffure 3D »** (ou glisser le fichier `.glb` sur l'écran).

- La coiffure s'affiche aussitôt sur le mannequin.
- La fenêtre donne le nombre de triangles et la taille en centimètres, et signale une échelle anormale.
- Renseigner le nom, la catégorie, la durée et le tarif, puis valider.

La coiffure est enregistrée **sur l'appareil**. Elle reste disponible aux ouvertures suivantes et peut être retirée depuis sa fiche.

## Problèmes fréquents

| Symptôme | Cause probable |
|---|---|
| Coiffure énorme ou minuscule | le mannequin a été redimensionné avant l'export, ou l'export ne s'est pas fait en mètres |
| Coiffure décalée | le mannequin ou la coiffure ont été déplacés : la coiffure doit garder la position du mannequin |
| « Ce fichier n'a pas pu être lu » | export en `.gltf` (texte) au lieu de `.glb`, ou compression Draco activée |
| Le visage est caché | des mèches passent devant le visage : les relever ou les raccourcir |
