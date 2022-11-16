import express, {
  ErrorRequestHandler,
  Express,
  NextFunction,
  Request,
  Response,
} from "express";
import bodyParser from "body-parser";
import helmet from "helmet";
import dotenv from "dotenv";
import cors from "cors";
import { routes } from "./api";
import { init } from "./initialise/init";
import { ResponseError } from "./customTypes/ResponseError";

dotenv.config();

const PORT = process.env.PORT || 3000;
const app: Express = express();

app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

init();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use(routes);

app.use(
  (
    err: ErrorRequestHandler,
    req: Request,
    res: Response,
    next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
  ) => {
    if (err instanceof ResponseError) {
      return res.status(err.statusCode).send(err.message);
    }
    res.status(500).send("there was an error");
  }
);

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
