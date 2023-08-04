import { useState } from "react";
import { useHistory } from "react-router-dom";
import { useLocalStorage } from "react-use";
import {
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
} from "@material-ui/core";

import axios from "axios";

function LogInUser() {
  const [open, setOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [, setLoggedIn] = useLocalStorage("loggedIn", false);
  const [, setToken] = useLocalStorage("token", null);

  const history = useHistory();

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSnackbarOpen(false);
  };

  const handleKeyPress = (event) => {
    const key = event.key;

    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (key === "Enter") {
      LogIn();
    }
  };

  const LogIn = () => {
    if (!username || !password) {
      return;
    }

    axios
      .post("/auth/login", {
        username: username,
        password: password,
      })
      .then(function (response) {
        setLoggedIn(true);
        setToken(response.data.token);
        handleClose();
        history.go(0);
      })
      .catch(function (error) {
        setPassword("");
        setSnackbarOpen(true);
        console.error(error);
      });
  };

  return (
    <>
      <Button onClick={handleClickOpen} color="primary" variant="contained">
        登录
      </Button>
      <Dialog open={open} onClose={handleClose} onKeyPress={handleKeyPress}>
        <DialogTitle>登录</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
            }}
            margin="dense"
            label="用户名"
            type="username"
            fullWidth
          />
          <TextField
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            margin="dense"
            label="密码"
            type="password"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            取消
          </Button>
          <Button onClick={LogIn} color="primary">
            登录
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbarOpen}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        message="用户名/密码错误"
      />
    </>
  );
}

export default LogInUser;
