import React from "react";
import RNTextInput from "react-native/Libraries/Components/TextInput/TextInput";
import { resolveRoobertStyle } from "./RoobertText";

const TextInput = React.forwardRef(function RoobertTextInput(props, ref) {
  return (
    <RNTextInput
      {...props}
      ref={ref}
      style={resolveRoobertStyle(props.style)}
    />
  );
});

TextInput.displayName = "TextInput";

export default TextInput;
