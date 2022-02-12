import React from "react";

import { makeStyles, useTheme, Typography } from "@material-ui/core";
import styles from "./styles";

import { BASE_URL } from "../../../constants/routes";

const useStyles = makeStyles(styles);

const ListItem = ({ object, onClick }) => {
  const theme = useTheme();
  const classes = useStyles(theme);

  let textClass = classes.text;
  if (!object.available) {
    textClass = [classes.text, classes.strike].join(" ");
  }
  return (
    <div className={classes.root} onClick={onClick}>
      <img className={classes.image} src={BASE_URL + object.imageUrl} />
      <Typography className={textClass} variant="body1">
        {object.text}
      </Typography>
    </div>
  );
};

export default ListItem;