import { Contract, ZeroAddress, parseEther, parseUnits } from "ethers";
import { ethers } from 'ethersv5';
import { BaseTransaction } from '@safe-global/safe-apps-sdk';
import { getSafeInfo, isConnectedToSafe, submitTxs } from "./safeapp";
import { isModuleEnabled, buildEnableModule, isGuardEnabled, buildEnableGuard } from "./safe";
import { getJsonRpcProvider, getProvider } from "./web3";
import Safe2LinkModule from "./Safe2LinkModule.json"
import { createSafeAccount, sendTransaction } from "./permissionless";
import { getTokenDecimals } from "./utils";
import { NetworkUtil } from "./networks";


// Plugin and Manager address

const moduleAddress = "0x664e3acE00b41ab503936010c7EBa9c7Fe24A4B9"

const getLinkCount = async (): Promise<number> => {


    const provider = await getProvider()
    // Updating the provider RPC if it's from the Safe App.
    const chainId = (await provider.getNetwork()).chainId.toString()
    const bProvider = await getJsonRpcProvider(chainId)


    const safe2link = new Contract(
        moduleAddress,
        Safe2LinkModule.abi,
        bProvider
    )

    return await safe2link.getLinkCount()

}


export const getLinkDetails = async (chainId: string, index: number): Promise<{}> => {


    const bProvider = await getJsonRpcProvider(chainId)


    const safe2link = new Contract(
        moduleAddress,
        Safe2LinkModule.abi,
        bProvider
    )

    return await safe2link.getLink(index)

}


function generateRandomString(length: number) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    return result;
}


/**
 * Generates a deterministic key pair from an arbitrary length string
 *
 * @param {string} string - The string to generate a key pair from
 * @returns {Object} - An object containing the address and privateKey
 */
export function generateKeysFromString(string: string) {
    const privateKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(string)) // v5
    const wallet = new ethers.Wallet(privateKey)
    return {
        address: wallet.address,
        privateKey: privateKey,
    }
}

/**
 * Hashes an address to a 32 byte hex string
 */
export function solidityHashAddress(address: string) {
    return ethers.utils.solidityKeccak256(['address'], [address]) // v5
}

/**
 * Adds the EIP191 prefix to a message and hashes it same as solidity
 */
export function solidityHashBytesEIP191(bytes: any) {
    return ethers.utils.hashMessage(bytes) // v5
}



/**
 * Hashes a plain address, adds an Ethereum message prefix, hashes it again and then signs it
 */
export async function signAddress(string: string, privateKey: string) {
    const stringHash = ethers.utils.solidityKeccak256(['address'], [string]) // v5
    const stringHashbinary = ethers.utils.arrayify(stringHash) // v5
    const signer = new ethers.Wallet(privateKey)
    const signature = await signer.signMessage(stringHashbinary) // this calls ethers.hashMessage and prefixes the hash
    return signature
}





const buildCreateLink = async (publicAddress: string, token: string, amount: string): Promise<BaseTransaction> => {


    const provider = await getProvider()
    // Updating the provider RPC if it's from the Safe App.
    const chainId = (await provider.getNetwork()).chainId.toString()
    const bProvider = await getJsonRpcProvider(chainId)


    const safe2link = new Contract(
        moduleAddress,
        Safe2LinkModule.abi,
        bProvider
    )


    let parseAmount;
    if(token == ZeroAddress) {
            parseAmount = parseEther(amount);
        } else {
            parseAmount = parseUnits(amount, await  getTokenDecimals(token, provider))
        }

    return {
        to: moduleAddress,
        value: "0",
        data: (await safe2link.createLink.populateTransaction(token, parseAmount, publicAddress)).data
    }
}


export const claimLink = async(chainId: string, index: number, seed: string, account: any): Promise<any> => {
    

    const bProvider = await getJsonRpcProvider(chainId)

    const { address, privateKey } = generateKeysFromString(seed)



    const addressHash = solidityHashAddress(account.address)
	const addressHashBinary = ethers.utils.arrayify(addressHash) // v5
	const addressHashEIP191 = solidityHashBytesEIP191(addressHashBinary)


	const signature = signAddress(account.address, privateKey) // sign with link keys

    const safe2link = new Contract(
        moduleAddress,
        Safe2LinkModule.abi,
        bProvider
    )

    const data = await safe2link.claimLink.populateTransaction(index, account.address, addressHashEIP191, signature, NetworkUtil.getNetworkById(parseInt(chainId))?.managerAddress)


    return await sendTransaction(chainId, moduleAddress, data.data, account)

} 



export const createLink = async (token: string, amount: string) => {

    

    if (!await isConnectedToSafe()) throw Error("Not connected to a Safe")

    const info = await getSafeInfo()

    const txs: BaseTransaction[] = []

    const randomSeed = generateRandomString(18)

    const { address, privateKey } = generateKeysFromString(randomSeed)

    txs.push(await buildCreateLink(address, token, amount))

    const provider = await getProvider()
    // Updating the provider RPC if it's from the Safe App.
    const chainId = (await provider.getNetwork()).chainId.toString()

    const index = await getLinkCount()


    if (txs.length == 0) return
    await submitTxs(txs)

    return { i: Number(index), p: randomSeed, c: chainId }
}




