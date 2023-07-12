import React, { useState, useEffect, useContext } from 'react';

import Wenb3Modal from 'web3modal';
import { ethers } from 'ethers';
import Router from 'next/router';
import axios from 'axios';
import { create as ifpsHttpClient } from 'ipfs-http-client';

const client = ifpsHttpClient("https://ipfs.infura.io:5001/api/v0");

import { NFTMarketplaceAddress, NFTMarketplaceABI } from './NFTMarketplace.json';

const fetchContract = (signerOrProvider) => new ethers.Contract(NFTMarketplaceAddress, NFTMarketplaceABI, signerOrProvider);

const connectingWithSmartContract = async () => {
    try {
        const web3modal = new Wenb3Modal();
        const connection = await web3modal.connect();
        const provider = new ethers.providers.Web3Provider(connection);
        const signer = provider.getSigner();
        const contract = fetchContract(signer);
        return contract;
    } catch (error) {
        console.log("Something went wrong while connecting with contract");
    }
};

export const NFTMarketplaceContext = React.createContext();

export const NFTMarketplaceProvider = ({ children }) => {
    const titleData = "Discover, collect, sell NFTs";

    const [currentAccount, setCurrentAccount] = useState("");

    const checkIfWalletConnected = async () => {
        try {
            if (!window.ethereum) return console.log("Install MetaMask");

            const accounts = await window.ethereum.request({
                method: "eth_accounts",
            });

            if (accounts.length) {
                setCurrentAccount(accounts[0]);
            } else {
                console.log("No Account Found");
            }
        } catch (error) {
            console.log("Something wrong while connecting to wallet!");
        }
    };

    const connectWallet = async () => {
        try {
            if (!window.ethereum) return console.log("Install MetaMask");

            const accounts = await window.ethereum.request({
                method: "eth_requestAccount",
            });

            setCurrentAccount(accounts[0]);
            window.location.reload();

        } catch (error) {
            console.log("Error while connecting to wallet");
        }
    };

    const uploadToIPFS = async(file) => {
        try {
            const added = await client.add({content:file});
            const url1 = `https://ipfs.infura.io/ipfs/${added.path}`;

            return url1;
        } catch (error) {
            console.log("Error Uploading to IPFS");
        }
    };

    return (
        <NFTMarketplaceContext.Provider value={{ checkIfWalletConnected, connectWallet, uploadToIPFS, titleData }}>
            {children}
        </NFTMarketplaceContext.Provider>
    );
}