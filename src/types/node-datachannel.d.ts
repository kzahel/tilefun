declare module "node-datachannel" {
  export interface DataChannelInitConfig {
    protocol?: string;
    negotiated?: boolean;
    id?: number;
    unordered?: boolean;
    maxPacketLifeTime?: number;
    maxRetransmits?: number;
  }

  export interface PeerConnectionLike {
    onLocalDescription?(handler: (sdp: string, type: "offer" | "answer") => void): void;
    onLocalCandidate?(handler: (candidate: string, sdpMid: string) => void): void;
    onDataChannel?(handler: (dc: DataChannelLike) => void): void;
    onStateChange?(handler: (state: string) => void): void;
    setRemoteDescription?(sdp: string, type: "offer" | "answer"): void;
    addRemoteCandidate?(candidate: string, sdpMid?: string): void;
    createDataChannel?(label: string, config?: DataChannelInitConfig): DataChannelLike;
    close?(): void;
  }

  export interface DataChannelLike {
    getLabel?(): string;
    onOpen?(handler: () => void): void;
    onClosed?(handler: () => void): void;
    onError?(handler: (err: string) => void): void;
    onMessage?(handler: (data: string | ArrayBuffer | Uint8Array) => void): void;
    sendMessageBinary?(data: Uint8Array): boolean;
    sendMessage?(data: string | Uint8Array): boolean;
    close?(): void;
  }

  export interface NodeDataChannelModuleLike {
    initLogger?(level: string): void;
    cleanup?(): void;
    PeerConnection: new (
      name: string,
      config?: {
        iceServers?: readonly string[];
      },
    ) => PeerConnectionLike;
  }

  const nodeDataChannel: NodeDataChannelModuleLike;
  export default nodeDataChannel;
}
