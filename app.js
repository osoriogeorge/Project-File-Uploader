const express = require("express");
const session = require("express-session");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const { PrismaClient } = require("@prisma/client");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const uploadToCloudinary = multer({ storage: multer.memoryStorage() });

const prisma = new PrismaClient();
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(
  session({
    secret: "tu-secreto-seguro", // ¡Reemplaza esto con una clave secreta fuerte!
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
    }),
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Configuración de la estrategia local de Passport
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { username } });

      if (!user) {
        return done(null, false, { message: "Nombre de usuario incorrecto." });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return done(null, false, { message: "Contraseña incorrecta." });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

// Serialización y deserialización de usuarios
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Middleware para proteger rutas
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

// Función auxiliar para formatear el tamaño del archivo
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Rutas
app.get("/", (req, res) =>
  res.send('Página principal <a href="/login">Iniciar Sesión</a>')
);
app.get("/login", (req, res) =>
  res.send(`
  <h1>Iniciar Sesión</h1>
  <form action="/login" method="POST">
    <div>
      <label for="username">Nombre de usuario:</label>
      <input type="text" name="username" id="username" required>
    </div>
    <div>
      <label for="password">Contraseña:</label>
      <input type="password" name="password" id="password" required>
    </div>
    <button type="submit">Iniciar Sesión</button>
  </form>
  <p><a href="/register">Registrarse</a></p>
`)
);
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true,
  })
);
app.get("/register", (req, res) =>
  res.send(`
  <h1>Registrarse</h1>
  <form action="/register" method="POST">
    <div>
      <label for="username">Nombre de usuario:</label>
      <input type="text" name="username" id="username" required>
    </div>
    <div>
      <label for="password">Contraseña:</label>
      <input type="password" name="password" id="password" required>
    </div>
    <button type="submit">Registrarse</button>
  </form>
  <p><a href="/login">Iniciar Sesión</a></p>
`)
);
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });
    res.redirect("/login");
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    res.status(500).send("Error al registrar usuario.");
  }
});
app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});
app.get("/dashboard", isAuthenticated, async (req, res) => {
  const folders = await prisma.folder.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  res.send(`
    <h1>Panel de Control</h1>
    <p>Bienvenido, ${req.user.username}!</p>
    <h2>Tus Carpetas</h2>
    <ul>
      ${folders
        .map(
          (folder) =>
            `<li><a href="/folders/${folder.id}">${folder.name}</a> <a href="/folders/${folder.id}/edit">Editar</a> <form action="/folders/${folder.id}/delete" method="POST" style="display: inline;"><button type="submit" onclick="return confirm('¿Estás seguro de que quieres eliminar esta carpeta?')">Eliminar</button></form></li>`
        )
        .join("")}
    </ul>
    <p><a href="/folders/create">Crear Nueva Carpeta</a> | <a href="/upload">Subir Archivo (sin carpeta)</a> | <a href="/logout">Cerrar Sesión</a></p>
  `);
});

// Rutas para Carpetas
app.get("/folders", isAuthenticated, async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.send(`
      <h1>Tus Carpetas</h1>
      <ul>
        ${folders
          .map(
            (folder) =>
              `<li><a href="/folders/${folder.id}">${folder.name}</a> <a href="/folders/${folder.id}/edit">Editar</a> <form action="/folders/${folder.id}/delete" method="POST" style="display: inline;"><button type="submit" onclick="return confirm('¿Estás seguro de que quieres eliminar esta carpeta?')">Eliminar</button></form></li>`
          )
          .join("")}
      </ul>
      <p><a href="/folders/create">Crear Nueva Carpeta</a> | <a href="/dashboard">Volver al Panel de Control</a></p>
    `);
  } catch (error) {
    console.error("Error al listar carpetas:", error);
    res.status(500).send("Error al obtener las carpetas.");
  }
});

app.get("/folders/create", isAuthenticated, (req, res) => {
  res.send(`
    <h1>Crear Nueva Carpeta</h1>
    <form action="/folders/create" method="POST">
      <div>
        <label for="name">Nombre de la Carpeta:</label>
        <input type="text" name="name" id="name" required>
      </div>
      <button type="submit">Crear</button>
    </form>
    <p><a href="/folders">Volver a Carpetas</a> | <a href="/dashboard">Volver al Panel de Control</a></p>
  `);
});

app.post("/folders/create", isAuthenticated, async (req, res) => {
  const { name } = req.body;
  try {
    const newFolder = await prisma.folder.create({
      data: {
        name: name,
        userId: req.user.id,
      },
    });
    res.redirect("/folders");
  } catch (error) {
    console.error("Error al crear la carpeta:", error);
    res.status(500).send("Error al crear la carpeta.");
  }
});

app.get("/folders/:folderId", isAuthenticated, async (req, res) => {
  const { folderId } = req.params;
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: parseInt(folderId), userId: req.user.id },
      include: { files: true },
    });
    if (!folder) {
      return res
        .status(404)
        .send("Carpeta no encontrada o no tienes permiso para acceder a ella.");
    }
    res.send(`
      <h1>Archivos en la Carpeta: ${folder.name}</h1>
      <ul>
        ${folder.files
          .map(
            (file) =>
              `<li><a href="/files/${file.id}">${
                file.originalName
              }</a> (${formatBytes(file.size)})</li>`
          )
          .join("")}
      </ul>
      <h2>Subir Nuevo Archivo a "<span class="math-inline">\{folder\.name\}"</h2\>
<form action\="/folders/</span>{folderId}/upload" method="POST" enctype="multipart/form-data">
        <div>
          <label for="file">Seleccionar archivo:</label>
          <input type="file" name="file" id="file" required>
        </div>
        <button type="submit">Subir</button>
      </form>
      <p><a href="/folders">Volver a Carpetas</a> | <a href="/dashboard">Volver al Panel de Control</a></p>
    `);
  } catch (error) {
    console.error("Error al obtener la carpeta o sus archivos:", error);
    res.status(500).send("Error al obtener la información de la carpeta.");
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folderId = req.params.folderId || "uncategorized";
    const uploadDir = path.join(__dirname, "uploads", folderId);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + fileExtension);
  },
});

const uploadToFolder = multer({ storage: storage });

app.post(
  "/folders/:folderId/upload",
  isAuthenticated,
  uploadToCloudinary.single("file"),
  async (req, res) => {
    const { folderId } = req.params;
    if (!req.file) {
      return res.status(400).send("No se seleccionó ningún archivo.");
    }
    try {
      const cloudinaryResult = await cloudinary.uploader.upload(
        req.file.buffer.toString("base64"),
        {
          resource_type: "auto", // Detecta automáticamente el tipo de recurso
          folder: folderId, // Opcional: guarda los archivos en carpetas en Cloudinary
          filename_override: `${req.user.id}-${Date.now()}-${
            req.file.originalname
          }`, // Nombre de archivo personalizado
        }
      );

      const folder = await prisma.folder.findUnique({
        where: { id: parseInt(folderId), userId: req.user.id },
      });

      const newFile = await prisma.file.create({
        data: {
          filename: cloudinaryResult.public_id, // Guardamos el public_id de Cloudinary como nombre
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url: cloudinaryResult.secure_url, // Guardamos la URL segura del archivo en Cloudinary
          folderId: folder ? parseInt(folderId) : null,
          userId: req.user.id,
        },
      });
      console.log("Archivo subido a Cloudinary y registrado:", newFile);
      res.redirect(folder ? `/folders/${folderId}` : "/dashboard");
    } catch (error) {
      console.error(
        "Error al subir a Cloudinary o registrar el archivo:",
        error
      );
      res.status(500).send("Error al subir y registrar el archivo.");
    }
  }
);

app.get("/folders/:folderId/edit", isAuthenticated, async (req, res) => {
  const { folderId } = req.params;
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: parseInt(folderId), userId: req.user.id },
    });
    if (!folder) {
      return res
        .status(404)
        .send("Carpeta no encontrada o no tienes permiso para editarla.");
    }
    res.send(`
      <h1>Editar Carpeta</h1>
      <form action="/folders/<span class="math-inline">\{folderId\}/edit" method\="POST"\>
<div\>
<label for\="name"\>Nuevo Nombre\:</label\>
<input type\="text" name\="name" id\="name" value\="</span>{folder.name}" required>
        </div>
        <button type="submit">Guardar Cambios</button>
      </form>
      <p><a href="/folders/${folderId}">Volver a la Carpeta</a> | <a href="/folders">Volver a Carpetas</a> | <a href="/dashboard">Volver al Panel de Control</a></p>
    `);
  } catch (error) {
    console.error("Error al obtener la carpeta para editar:", error);
    res
      .status(500)
      .send("Error al obtener la información de la carpeta para editar.");
  }
});

app.post("/folders/:folderId/edit", isAuthenticated, async (req, res) => {
  const { folderId } = req.params;
  const { name } = req.body;
  try {
    const updatedFolder = await prisma.folder.update({
      where: { id: parseInt(folderId), userId: req.user.id },
      data: { name: name },
    });
    res.redirect("/folders");
  } catch (error) {
    console.error("Error al actualizar la carpeta:", error);
    res.status(500).send("Error al actualizar la carpeta.");
  }
});

app.post("/folders/:folderId/delete", isAuthenticated, async (req, res) => {
  const { folderId } = req.params;
  try {
    await prisma.folder.delete({
      where: { id: parseInt(folderId), userId: req.user.id },
    });
    // Considera aquí la lógica para eliminar los archivos asociados del sistema de archivos si es necesario
    res.redirect("/folders");
  } catch (error) {
    console.error("Error al eliminar la carpeta:", error);
    res.status(500).send("Error al eliminar la carpeta.");
  }
});

// Rutas para Archivos
app.get("/files/:fileId", isAuthenticated, async (req, res) => {
  const { fileId } = req.params;
  try {
    const file = await prisma.file.findUnique({
      where: { id: parseInt(fileId), userId: req.user.id },
    });
    if (!file) {
      return res
        .status(404)
        .send("Archivo no encontrado o no tienes permiso para acceder a él.");
    }
    res.send(`
        <h1>Detalles del Archivo</h1>
        <p><strong>Nombre:</strong> ${file.originalName}</p>
        <p><strong>Nombre en Cloudinary:</strong> ${file.filename}</p>
        <p><strong>Tipo:</strong> ${file.mimeType}</p>
        <p><strong>Tamaño:</strong> ${formatBytes(file.size)}</p>
        <p><strong>Subido el:</strong> ${file.createdAt.toLocaleString()}</p>
        <a href="${
          file.url
        }" target="_blank" rel="noopener noreferrer">Ver/Descargar Archivo</a>
        <p><a href="/folders/${
          file.folderId || ""
        }">Volver a la Carpeta</a> | <a href="/folders">Volver a Carpetas</a> | <a href="/dashboard">Volver al Panel de Control</a></p>
      `);
  } catch (error) {
    console.error("Error al obtener los detalles del archivo:", error);
    res.status(500).send("Error al obtener los detalles del archivo.");
  }
});

app.get("/upload", isAuthenticated, (req, res) => {
  res.send(`
    <h1>Subir Archivo (sin carpeta)</h1>
    <form action="/upload" method="POST" enctype="multipart/form-data">
      <div>
        <label for="file">Seleccionar archivo:</label>
        <input type="file" name="file" id="file" required>
      </div>
      <button type="submit">Subir</button>
    </form>
    <p><a href="/dashboard">Volver al Panel de Control</a></p>
  `);
});

app.post(
  "/upload",
  isAuthenticated,
  uploadToCloudinary.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).send("No se seleccionó ningún archivo.");
    }
    try {
      const cloudinaryResult = await cloudinary.uploader.upload(
        req.file.buffer.toString("base64"),
        {
          resource_type: "auto",
          folder: "uncategorized", // O la carpeta que prefieras para archivos sin carpeta
          filename_override: `${req.user.id}-${Date.now()}-${
            req.file.originalname
          }`,
        }
      );

      const newFile = await prisma.file.create({
        data: {
          filename: cloudinaryResult.public_id,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url: cloudinaryResult.secure_url,
          userId: req.user.id,
          folderId: null,
        },
      });
      console.log(
        "Archivo subido a Cloudinary (sin carpeta) y registrado:",
        newFile
      );
      res.redirect("/dashboard");
    } catch (error) {
      console.error(
        "Error al subir a Cloudinary (sin carpeta) o registrar el archivo:",
        error
      );
      res.status(500).send("Error al subir y registrar el archivo.");
    }
  }
);

app.listen(3000, () => {
  console.log("Servidor escuchando en el puerto 3000");
});
